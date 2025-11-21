import { NextResponse } from 'next/server';
import { getTableName } from '../../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

async function logWebhookActivity(logData) {
  try {
    const tableName = getTableName('WebexMeetingsWebhookLogs');
    const logEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...logData
    };
    
    const command = new PutCommand({
      TableName: tableName,
      Item: logEntry
    });
    await docClient.send(command);
  } catch (error) {
    console.error('Failed to log webhook activity:', error);
  }
}

async function getWebexMeetingsConfig() {
  const timestamp = new Date().toISOString();
  const tableName = getTableName('Settings');
  console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] Loading config from table:`, tableName);
  const command = new GetCommand({
    TableName: tableName,
    Key: { setting_key: 'webex-meetings' }
  });
  const result = await docClient.send(command);
  console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] Raw config result:`, result.Item);
  const config = result.Item?.setting_value ? JSON.parse(result.Item.setting_value) : null;
  console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] Parsed config:`, JSON.stringify(config, null, 2));
  return config;
}

async function downloadRecording(downloadUrl, accessToken) {
  const response = await fetch(downloadUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error('Failed to download recording');
  return response.arrayBuffer();
}

async function uploadToS3(buffer, key) {
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'video/mp4'
  });
  await s3Client.send(command);
}

export async function POST(request) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] ========== WEBHOOK RECEIVED ==========`);
  console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] Request headers:`, JSON.stringify(Object.fromEntries(request.headers.entries()), null, 2));
  console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] Request method:`, request.method);
  console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] Request URL:`, request.url);
  
  let webhookData = null;
  try {
    const webhook = await request.json();
    console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] Parsed webhook data:`, JSON.stringify(webhook, null, 2));
    const { data } = webhook;
    webhookData = data;
    
    if (!data || webhook.resource !== 'recordings') {
      console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] ❌ Invalid webhook data:`, { data: !!data, resource: webhook.resource });
      await logWebhookActivity({
        webhookType: 'recordings',
        siteUrl: data?.siteUrl || 'unknown',
        meetingId: data?.meetingId || 'unknown',
        status: 'error',
        message: 'Invalid webhook data received',
        error: `Missing data or incorrect resource type: ${webhook.resource}`,
        databaseAction: 'none',
        s3Upload: false,
        sseNotification: false
      });
      return NextResponse.json({ error: 'Invalid webhook data' }, { status: 400 });
    }
    
    console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] ✓ Valid recordings webhook received for:`, data.id);

    // Get WebexMeetings configuration
    console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] Loading WebEx configuration...`);
    const config = await getWebexMeetingsConfig();
    console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] Config loaded:`, { enabled: config?.enabled, sitesCount: config?.sites?.length });
    
    if (!config?.enabled || !config.sites?.length) {
      console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] ⚠️ WebexMeetings not configured or disabled`);
      await logWebhookActivity({
        webhookType: 'recordings',
        siteUrl: data.siteUrl,
        meetingId: data.meetingId,
        status: 'warning',
        message: 'WebexMeetings integration not configured or disabled',
        databaseAction: 'none',
        s3Upload: false,
        sseNotification: false
      });
      return NextResponse.json({ message: 'WebexMeetings not configured' }, { status: 200 });
    }

    // Find matching site configuration
    console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] Looking for matching site:`, { 
      siteUrl: data.siteUrl, 
      hostUserId: data.hostUserId,
      hostEmail: data.hostEmail,
      creatorId: data.creatorId
    });
    console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] Available sites:`, config.sites.map(s => ({ siteUrl: s.siteUrl, hosts: s.recordingHosts })));
    
    const matchingSite = config.sites.find(site => {
      if (data.siteUrl !== site.siteUrl) return false;
      
      // Check if hostUserId or hostEmail matches any configured recording host
      return site.recordingHosts.some(host => {
        // Match by userId if both are available
        if (data.hostUserId && host.userId && host.userId === data.hostUserId) {
          return true;
        }
        // Fall back to email matching
        if (data.hostEmail && host.email && host.email === data.hostEmail) {
          return true;
        }
        return false;
      });
    });

    if (!matchingSite) {
      console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] ⚠️ No matching site/host found`);
      await logWebhookActivity({
        webhookType: 'recordings',
        siteUrl: data.siteUrl,
        meetingId: data.meetingId,
        status: 'warning',
        message: 'Recording not from configured host/site',
        processingDetails: `Host identifiers [${[data.hostUserId, data.hostEmail, data.creatorId].filter(Boolean).join(', ')}] not in configured recording hosts [${config.sites.find(s => s.siteUrl === data.siteUrl)?.recordingHosts?.map(h => `${h.email}(${h.userId || 'no-id'})`).join(', ') || 'none'}]`,
        databaseAction: 'none',
        s3Upload: false,
        sseNotification: false
      });
      return NextResponse.json({ message: 'Recording not from configured host/site' }, { status: 200 });
    }
    
    console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] ✓ Found matching site:`, matchingSite.siteUrl);

    // Get valid access token for the site
    console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] Getting valid access token for site:`, data.siteUrl);
    const { getValidAccessToken } = await import('../../../../../lib/webex-token-manager.js');
    const validAccessToken = await getValidAccessToken(data.siteUrl);
    
    if (!validAccessToken) {
      throw new Error(`No valid access token available for site: ${matchingSite.siteUrl}`);
    }
    
    // Fetch recording details from Webex API to get download URL
    // Need to specify hostEmail parameter for admin access to recordings
    let hostEmail = data.hostEmail || matchingSite.recordingHosts.find(h => h.userId === data.hostUserId)?.email;
    
    console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] Available webhook fields:`, Object.keys(data));
    console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] Host identification:`, {
      webhookHostEmail: data.hostEmail,
      webhookHostUserId: data.hostUserId,
      resolvedHostEmail: hostEmail
    });
    
    let recordingResponse;
    
    if (hostEmail) {
      // Try with hostEmail parameter first
      console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] Fetching recording details for ID:`, data.id, 'with hostEmail:', hostEmail);
      recordingResponse = await fetch(`https://webexapis.com/v1/recordings/${data.id}?hostEmail=${encodeURIComponent(hostEmail)}`, {
        headers: { 'Authorization': `Bearer ${validAccessToken}` }
      });
    } else {
      // Fallback: try each configured recording host email until one works
      console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] No hostEmail available, trying each configured host...`);
      
      for (const host of matchingSite.recordingHosts) {
        console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] Trying hostEmail:`, host.email);
        recordingResponse = await fetch(`https://webexapis.com/v1/recordings/${data.id}?hostEmail=${encodeURIComponent(host.email)}`, {
          headers: { 'Authorization': `Bearer ${validAccessToken}` }
        });
        
        if (recordingResponse.ok) {
          hostEmail = host.email;
          console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] ✓ Success with hostEmail:`, hostEmail);
          break;
        } else {
          console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] ❌ Failed with hostEmail:`, host.email, 'Status:', recordingResponse.status);
        }
      }
    }
    
    if (!recordingResponse.ok) {
      const errorText = await recordingResponse.text();
      throw new Error(`Failed to fetch recording details with all available hostEmails. Last attempt status: ${recordingResponse.status} ${recordingResponse.statusText}. Error: ${errorText}`);
    }
    
    const recordingDetails = await recordingResponse.json();
    console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] Recording details:`, JSON.stringify(recordingDetails, null, 2));
    
    const downloadUrl = recordingDetails.temporaryDirectDownloadLinks?.recordingDownloadLink || recordingDetails.downloadUrl;
    if (!downloadUrl) {
      throw new Error('No download URL found in recording details');
    }
    
    // Download recording
    console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] Downloading recording from:`, downloadUrl);
    const recordingBuffer = await downloadRecording(downloadUrl, validAccessToken);
    console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] ✓ Recording downloaded, size:`, recordingBuffer.byteLength, 'bytes');
    
    // Upload to S3
    const s3Key = `webexmeetings-recordings/${data.id}.mp4`;
    console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] Uploading to S3:`, s3Key);
    await uploadToS3(recordingBuffer, s3Key);
    console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] ✓ S3 upload completed`);

    // Store in DynamoDB
    const tableName = getTableName('WebexMeetingsRecordings');
    // hostEmail was already resolved above from configured recording hosts
    
    const recordingData = {
      id: data.id,
      meetingId: data.meetingId,
      meetingInstanceId: data.meetingInstanceId,
      hostUserId: data.hostUserId,
      hostEmail: hostEmail,
      siteUrl: data.siteUrl,
      topic: recordingDetails.topic || data.topic || 'Untitled Meeting',
      createTime: data.createTime,
      s3Key,
      s3Url: `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${s3Key}`,
      downloadUrl: `/api/webexmeetings/recordings/${data.id}/download`,
      status: 'available',
      transcriptRetryCount: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const putCommand = new PutCommand({
      TableName: tableName,
      Item: recordingData
    });
    await docClient.send(putCommand);
    console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] ✓ Recording data saved to DynamoDB`);

    // Send SSE notification for new recording
    try {
      const { notifyWebexRecordingsUpdate } = await import('../../../sse/webex-meetings/route.js');
      notifyWebexRecordingsUpdate();
    } catch (sseError) {
      console.error('Failed to send SSE notification for new recording:', sseError);
    }

    // Try to get transcript immediately
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webexmeetings/recordings/${data.id}/transcript`, {
        method: 'POST'
      });
    } catch (error) {
      console.log('Transcript fetch initiated:', error.message);
    }

    console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] ========== ✓ SUCCESS - Processing completed ==========`);
    await logWebhookActivity({
      webhookType: 'recordings',
      siteUrl: data.siteUrl,
      meetingId: data.meetingId,
      status: 'success',
      message: 'Recording processed successfully',
      processingDetails: `Downloaded and uploaded to S3: ${s3Key}`,
      databaseAction: 'created',
      s3Upload: true,
      sseNotification: true
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] ========== ❌ ERROR - Processing failed ==========`);
    console.error(`[${timestamp}] 🎥 [RECORDINGS-WEBHOOK] Error details:`, {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    await logWebhookActivity({
      webhookType: 'recordings',
      siteUrl: webhookData?.siteUrl || 'unknown',
      meetingId: webhookData?.meetingId || 'unknown',
      status: 'error',
      message: 'Recording processing failed',
      error: error.message,
      processingDetails: error.stack,
      databaseAction: 'none',
      s3Upload: false,
      sseNotification: false
    });
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

async function processTranscript(transcript, recording, accessToken) {
  try {
    const transcriptResponse = await fetch(transcript.downloadUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!transcriptResponse.ok) return;
    
    const transcriptBuffer = await transcriptResponse.arrayBuffer();
    const transcriptS3Key = `webexmeetings-transcripts/${transcript.id}.vtt`;
    
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: transcriptS3Key,
      Body: transcriptBuffer,
      ContentType: 'text/vtt'
    });
    await s3Client.send(command);

    const tableName = getTableName('WebexMeetingsRecordings');
    const updateCommand = new PutCommand({
      TableName: tableName,
      Item: {
        ...recording,
        transcriptId: transcript.id,
        transcriptS3Key,
        transcriptS3Url: `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${transcriptS3Key}`,
        status: 'completed',
        updated_at: new Date().toISOString()
      }
    });
    await docClient.send(updateCommand);

    // Send SSE notification for transcript update
    try {
      const { notifyWebexRecordingsUpdate } = await import('../../../sse/webex-meetings/route.js');
      notifyWebexRecordingsUpdate();
    } catch (sseError) {
      console.error('Failed to send SSE notification for transcript update:', sseError);
    }
  } catch (error) {
    console.error('WebexMeetings transcript processing error:', error);
  }
}