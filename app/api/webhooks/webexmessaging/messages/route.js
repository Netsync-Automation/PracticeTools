import { NextResponse } from 'next/server';
import { getTableName } from '../../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { notifyWebexMessagesUpdate } from '../../../sse/webex-messages/route';
import { getValidAccessToken } from '../../../../../lib/webex-token-manager';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

async function getSiteUrlFromRoomId(roomId) {
  const tableName = getTableName('Settings');
  const command = new GetCommand({
    TableName: tableName,
    Key: { setting_key: 'webex-meetings' }
  });
  const result = await docClient.send(command);
  if (result.Item?.setting_value) {
    const config = JSON.parse(result.Item.setting_value);
    for (const site of config.sites || []) {
      if (site.monitoredRooms?.find(r => r.id === roomId)) {
        return site.siteUrl;
      }
    }
  }
  return null;
}

function maskToken(token) {
  if (!token) return 'null';
  return token.length > 20 ? `${token.substring(0, 20)}...${token.substring(token.length - 10)}` : '***';
}

function maskSensitiveData(obj) {
  if (!obj) return obj;
  const masked = JSON.parse(JSON.stringify(obj));
  if (masked.personEmail) masked.personEmail = masked.personEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3');
  return masked;
}

async function logWebhookActivity(logData) {
  try {
    const logsTableName = getTableName('WebexMeetingsWebhookLogs');
    await docClient.send(new PutCommand({
      TableName: logsTableName,
      Item: {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        ...logData
      }
    }));
  } catch (error) {
    console.error('[WEBHOOK-LOG-ERROR] Failed to log webhook activity:', error.name, error.message);
    // Don't throw - logging failure shouldn't break webhook processing
  }
}

export async function POST(request) {
  const startTime = Date.now();
  let siteUrl = null;
  let messageId = null;
  const requestId = `msg-${Date.now()}`;
  const trace = [];
  
  try {
    console.error(`[WEBHOOK-MSG-DEBUG] [${requestId}] Webhook received`);
    const payload = await request.json();
    trace.push({ step: 'webhook_received', timestamp: new Date().toISOString(), data: maskSensitiveData(payload) });
    console.error(`[WEBHOOK-MSG-DEBUG] [${requestId}] Payload:`, JSON.stringify(payload, null, 2));
    messageId = payload.data?.id;
    const roomId = payload.data?.roomId;
    
    if (!messageId || !roomId) {
      console.error(`[WEBHOOK-MSG-DEBUG] [${requestId}] Missing messageId or roomId, skipping`);
      trace.push({ step: 'validation_failed', timestamp: new Date().toISOString(), reason: 'Missing messageId or roomId' });
      return NextResponse.json({ success: true });
    }
    
    console.error(`[WEBHOOK-MSG-DEBUG] [${requestId}] Processing messageId=${messageId} roomId=${roomId}`);
    trace.push({ step: 'lookup_site', timestamp: new Date().toISOString(), roomId });
    siteUrl = await getSiteUrlFromRoomId(roomId);
    if (!siteUrl) {
      console.error(`[WEBHOOK-MSG-DEBUG] [${requestId}] Room not monitored: ${roomId}`);
      trace.push({ step: 'room_not_monitored', timestamp: new Date().toISOString(), roomId });
      return NextResponse.json({ success: true });
    }
    console.error(`[WEBHOOK-MSG-DEBUG] [${requestId}] Found siteUrl=${siteUrl}`);
    trace.push({ step: 'site_found', timestamp: new Date().toISOString(), siteUrl });
    
    console.error(`[WEBHOOK-MSG-DEBUG] [${requestId}] Calling getValidAccessToken(${siteUrl})`);
    const accessToken = await getValidAccessToken(siteUrl);
    console.error(`[WEBHOOK-MSG-DEBUG] [${requestId}] Token retrieved: length=${accessToken?.length} first50=${accessToken?.substring(0, 50)}`);
    trace.push({ step: 'token_retrieved', timestamp: new Date().toISOString(), tokenLength: accessToken?.length, tokenPreview: maskToken(accessToken) });
    
    const apiUrl = `https://webexapis.com/v1/messages?roomId=${roomId}&max=50`;
    console.error(`[WEBHOOK-MSG-DEBUG] [${requestId}] Calling Webex API: ${apiUrl}`);
    console.error(`[WEBHOOK-MSG-DEBUG] [${requestId}] Authorization: Bearer ${accessToken?.substring(0, 50)}...`);
    trace.push({ step: 'api_call_start', timestamp: new Date().toISOString(), url: apiUrl, method: 'GET', authorization: `Bearer ${maskToken(accessToken)}` });
    
    const messagesResponse = await fetch(apiUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    console.error(`[WEBHOOK-MSG-DEBUG] [${requestId}] API response status=${messagesResponse.status}`);
    console.error(`[WEBHOOK-MSG-DEBUG] [${requestId}] API response headers:`, JSON.stringify(Object.fromEntries(messagesResponse.headers.entries())));
    
    if (!messagesResponse.ok) {
      const errorText = await messagesResponse.text();
      console.error(`[WEBHOOK-MSG-DEBUG] [${requestId}] API ERROR: status=${messagesResponse.status} body=${errorText}`);
      trace.push({ step: 'api_call_failed', timestamp: new Date().toISOString(), status: messagesResponse.status, error: errorText });
      throw new Error(`Failed to list messages: ${messagesResponse.status} - ${errorText}`);
    }
    
    const messagesData = await messagesResponse.json();
    console.error(`[WEBHOOK-MSG-DEBUG] [${requestId}] API returned ${messagesData.items?.length} messages`);
    trace.push({ step: 'api_call_success', timestamp: new Date().toISOString(), status: messagesResponse.status, messageCount: messagesData.items?.length });
    
    const message = messagesData.items?.find(m => m.id === messageId);
    
    if (!message) {
      console.error(`[WEBHOOK-MSG-DEBUG] [${requestId}] Message ${messageId} not found in list of ${messagesData.items?.length} messages`);
      trace.push({ step: 'message_not_found', timestamp: new Date().toISOString(), messageId, totalMessages: messagesData.items?.length });
      throw new Error(`Message ${messageId} not found in room messages`);
    }
    
    console.error(`[WEBHOOK-MSG-DEBUG] [${requestId}] Found message in list`);
    trace.push({ step: 'message_found', timestamp: new Date().toISOString(), message: maskSensitiveData(message) });
    const attachments = [];
    let s3Uploaded = false;
    
    async function downloadWithRetry(fileUrl, maxAttempts = 6) {
      let delay = 0;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (delay) await new Promise(r => setTimeout(r, delay));
        
        const res = await fetch(fileUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          redirect: 'follow'
        });
        
        if (res.ok) {
          return { success: true, response: res, attempts: attempt };
        }
        
        if (res.status === 423) {
          const retryAfter = parseInt(res.headers.get('retry-after') || '5', 10);
          delay = (retryAfter + 5) * 1000;
          trace.push({ step: 'file_scan_pending', timestamp: new Date().toISOString(), attempt, retryAfter, fileUrl });
          if (attempt === 1) {
            return { success: false, status: 'pending_scan', retryAfter, attempt };
          }
          continue;
        }
        
        if (res.status === 428) {
          return { success: false, status: 'scan_blocked', message: 'File scan blocked by policy' };
        }
        
        return { success: false, status: 'download_failed', httpStatus: res.status };
      }
      return { success: false, status: 'infected', message: 'File failed malware scan' };
    }
    
    if (message.files && message.files.length > 0) {
      console.error(`[WEBHOOK-MSG-DEBUG] [${requestId}] Processing ${message.files.length} attachments`);
      trace.push({ step: 'attachment_processing_start', timestamp: new Date().toISOString(), fileCount: message.files.length });
      
      for (const fileUrl of message.files) {
        try {
          console.error(`[WEBHOOK-MSG-DEBUG] [${requestId}] Downloading file: ${fileUrl}`);
          trace.push({ step: 'file_download_start', timestamp: new Date().toISOString(), fileUrl });
          
          const downloadResult = await downloadWithRetry(fileUrl);
          
          if (downloadResult.success) {
            const fileBuffer = await downloadResult.response.arrayBuffer();
            const contentDisposition = downloadResult.response.headers.get('content-disposition');
            let fileName = `file-${uuidv4()}`;
            
            if (contentDisposition) {
              const match = contentDisposition.match(/filename="?([^"]+)"?/);
              if (match) fileName = match[1];
            }
            
            const s3Key = `webex-messages/${siteUrl}/${roomId}/${messageId}/${fileName}`;
            console.error(`[WEBHOOK-MSG-DEBUG] [${requestId}] Uploading to S3: ${s3Key}`);
            trace.push({ step: 's3_upload_start', timestamp: new Date().toISOString(), fileName, s3Key, fileSize: fileBuffer.byteLength, attempts: downloadResult.attempts });
            
            await s3Client.send(new PutObjectCommand({
              Bucket: process.env.S3_BUCKET,
              Key: s3Key,
              Body: Buffer.from(fileBuffer),
              ContentType: downloadResult.response.headers.get('content-type') || 'application/octet-stream'
            }));
            
            console.error(`[WEBHOOK-MSG-DEBUG] [${requestId}] File uploaded successfully: ${fileName}`);
            trace.push({ step: 's3_upload_success', timestamp: new Date().toISOString(), fileName, s3Key });
            attachments.push({ fileName, s3Key, status: 'available', fileUrl });
            s3Uploaded = true;
          } else {
            console.error(`[WEBHOOK-MSG-DEBUG] [${requestId}] File download failed: ${downloadResult.status}`);
            trace.push({ step: 'file_download_failed', timestamp: new Date().toISOString(), status: downloadResult.status, fileUrl });
            
            let status = 'failed';
            let error = downloadResult.message;
            
            if (downloadResult.status === 'infected') {
              status = 'infected';
              error = 'Malware/Virus scan detected an infection in this file and it cannot be downloaded';
            } else if (downloadResult.status === 'pending_scan') {
              status = 'pending_scan';
              error = 'File is being scanned for malware';
            } else if (downloadResult.status === 'scan_blocked') {
              status = 'scan_blocked';
              error = 'File scan blocked by organizational policy';
            }
            
            attachments.push({ 
              fileName: fileUrl.split('/').pop(), 
              status,
              error,
              fileUrl 
            });
          }
        } catch (fileError) {
          console.error(`[WEBHOOK-MSG-DEBUG] [${requestId}] Error processing file ${fileUrl}:`, fileError.message);
          trace.push({ step: 'file_processing_error', timestamp: new Date().toISOString(), error: fileError.message, fileUrl });
          attachments.push({ fileName: fileUrl.split('/').pop(), status: 'error', error: fileError.message, fileUrl });
        }
      }
      console.error(`[WEBHOOK-MSG-DEBUG] [${requestId}] Attachment processing complete: ${attachments.length} processed`);
      trace.push({ step: 'attachment_processing_complete', timestamp: new Date().toISOString(), totalCount: attachments.length });
    }
    
    const tableName = getTableName('WebexMessages');
    trace.push({ step: 'save_to_db', timestamp: new Date().toISOString(), tableName });
    await docClient.send(new PutCommand({
      TableName: tableName,
      Item: {
        message_id: messageId,
        room_id: roomId,
        site_url: siteUrl,
        person_email: message.personEmail,
        person_id: message.personId,
        text: message.text || '',
        html: message.html || '',
        created: message.created,
        attachments,
        timestamp: new Date().toISOString()
      }
    }));
    
    console.error(`[WEBHOOK-MSG-DEBUG] [${requestId}] Message saved successfully`);
    trace.push({ step: 'db_save_success', timestamp: new Date().toISOString() });
    notifyWebexMessagesUpdate();
    trace.push({ step: 'sse_notified', timestamp: new Date().toISOString() });
    
    trace.push({ step: 'completed', timestamp: new Date().toISOString(), duration: `${Date.now() - startTime}ms` });
    await logWebhookActivity({
      webhookType: 'messages',
      siteUrl,
      messageId: messageId,
      status: 'success',
      message: `Message processed from ${message.personEmail}`,
      processingDetails: `Processed in ${Date.now() - startTime}ms. Attachments: ${attachments.length}`,
      databaseAction: 'created',
      s3Upload: s3Uploaded,
      sseNotification: true,
      trace: JSON.stringify(trace)
    });
    
    console.error(`[WEBHOOK-MSG-DEBUG] [${requestId}] SUCCESS - Completed in ${Date.now() - startTime}ms`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[WEBHOOK-MSG-DEBUG] [${requestId}] ERROR:`, error.message);
    console.error(`[WEBHOOK-MSG-DEBUG] [${requestId}] Stack:`, error.stack);
    trace.push({ step: 'error', timestamp: new Date().toISOString(), error: error.message, stack: error.stack });
    
    await logWebhookActivity({
      webhookType: 'messages',
      siteUrl: siteUrl || 'unknown',
      messageId: messageId || 'unknown',
      status: 'error',
      message: 'Failed to process message webhook',
      error: error.message,
      processingDetails: `Failed after ${Date.now() - startTime}ms`,
      databaseAction: 'none',
      s3Upload: false,
      sseNotification: false,
      trace: JSON.stringify(trace)
    });
    
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
