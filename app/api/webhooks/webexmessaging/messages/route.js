import { NextResponse } from 'next/server';
import { getTableName } from '../../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { v4 as uuidv4 } from 'uuid';
import { notifyWebexMessagesUpdate } from '../../../sse/webex-messages/route';
import { getSitePrefix, getSSMPath } from '../../../../../lib/ssm';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

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

async function getServiceAppToken(siteUrl) {
  const sitePrefix = getSitePrefix(siteUrl);
  const tokenPath = getSSMPath(`${sitePrefix}_WEBEX_MEETINGS_ACCESS_TOKEN`);
  
  try {
    const result = await ssmClient.send(new GetParameterCommand({ Name: tokenPath }));
    return result.Parameter.Value;
  } catch (error) {
    console.error(`Failed to get service app token for ${siteUrl}:`, error);
    throw new Error(`Service app token not found for ${siteUrl}`);
  }
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
    console.error('Failed to log webhook activity:', error);
  }
}

export async function POST(request) {
  const startTime = Date.now();
  let siteUrl = null;
  let messageId = null;
  
  try {
    console.log('📨 [WEBEX-MESSAGING] Webhook received');
    const payload = await request.json();
    console.log('📨 [WEBEX-MESSAGING] Payload:', JSON.stringify(payload, null, 2));
    messageId = payload.data?.id;
    const roomId = payload.data?.roomId;
    
    if (!messageId || !roomId) {
      console.log('📨 [WEBEX-MESSAGING] Missing messageId or roomId, skipping');
      return NextResponse.json({ success: true });
    }
    
    console.log('📨 [WEBEX-MESSAGING] Processing message:', messageId, 'in room:', roomId);
    siteUrl = await getSiteUrlFromRoomId(roomId);
    if (!siteUrl) {
      console.log('📨 [WEBEX-MESSAGING] Room not monitored:', roomId);
      return NextResponse.json({ success: true });
    }
    console.log('📨 [WEBEX-MESSAGING] Found site:', siteUrl);
    
    const accessToken = await getServiceAppToken(siteUrl);
    
    const messageResponse = await fetch(`https://webexapis.com/v1/messages/${messageId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!messageResponse.ok) {
      throw new Error(`Failed to fetch message: ${messageResponse.status}`);
    }
    
    const message = await messageResponse.json();
    const attachments = [];
    let s3Uploaded = false;
    
    if (message.files && message.files.length > 0) {
      for (const fileUrl of message.files) {
        const fileResponse = await fetch(fileUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (fileResponse.ok) {
          const fileBuffer = await fileResponse.arrayBuffer();
          const fileName = fileUrl.split('/').pop() || `file-${uuidv4()}`;
          const s3Key = `webex-messages/${siteUrl}/${roomId}/${messageId}/${fileName}`;
          
          await s3Client.send(new PutObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: s3Key,
            Body: Buffer.from(fileBuffer),
            ContentType: fileResponse.headers.get('content-type') || 'application/octet-stream'
          }));
          
          attachments.push({ fileName, s3Key });
          s3Uploaded = true;
        }
      }
    }
    
    const tableName = getTableName('WebexMessages');
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
    
    console.log('📨 [WEBEX-MESSAGING] Message saved successfully:', messageId);
    notifyWebexMessagesUpdate();
    
    await logWebhookActivity({
      webhookType: 'messages',
      siteUrl,
      meetingId: messageId,
      status: 'success',
      message: `Message processed from ${message.personEmail}`,
      processingDetails: `Processed in ${Date.now() - startTime}ms. Attachments: ${attachments.length}`,
      databaseAction: 'created',
      s3Upload: s3Uploaded,
      sseNotification: true
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('📨 [WEBEX-MESSAGING] Error:', error);
    
    await logWebhookActivity({
      webhookType: 'messages',
      siteUrl: siteUrl || 'unknown',
      meetingId: messageId || 'unknown',
      status: 'error',
      message: 'Failed to process message webhook',
      error: error.message,
      processingDetails: `Failed after ${Date.now() - startTime}ms`,
      databaseAction: 'none',
      s3Upload: false,
      sseNotification: false
    });
    
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
