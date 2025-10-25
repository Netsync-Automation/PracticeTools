import { NextResponse } from 'next/server';
import { getTableName } from '../../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
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
  const tableName = getTableName('Settings');
  console.log('📝 [TRANSCRIPTS-WEBHOOK] Loading config from table:', tableName);
  const command = new GetCommand({
    TableName: tableName,
    Key: { setting_key: 'webex-meetings' }
  });
  const result = await docClient.send(command);
  console.log('📝 [TRANSCRIPTS-WEBHOOK] Raw config result:', result.Item);
  const config = result.Item?.setting_value ? JSON.parse(result.Item.setting_value) : null;
  console.log('📝 [TRANSCRIPTS-WEBHOOK] Parsed config:', config);
  return config;
}

export async function POST(request) {
  console.log('📝 [TRANSCRIPTS-WEBHOOK] Received webhook request');
  console.log('📝 [TRANSCRIPTS-WEBHOOK] Request headers:', Object.fromEntries(request.headers.entries()));
  console.log('📝 [TRANSCRIPTS-WEBHOOK] Request method:', request.method);
  console.log('📝 [TRANSCRIPTS-WEBHOOK] Request URL:', request.url);
  
  let webhookData = null;
  try {
    const webhook = await request.json();
    console.log('📝 [TRANSCRIPTS-WEBHOOK] Parsed webhook data:', JSON.stringify(webhook, null, 2));
    const { data } = webhook;
    webhookData = data;
    
    if (!data || webhook.resource !== 'meetingTranscripts') {
      console.error('📝 [TRANSCRIPTS-WEBHOOK] Invalid webhook data:', { data: !!data, resource: webhook.resource });
      await logWebhookActivity({
        webhookType: 'transcripts',
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
    
    console.log('📝 [TRANSCRIPTS-WEBHOOK] Valid transcript webhook received for:', data.id);

    // Get WebexMeetings configuration
    console.log('📝 [TRANSCRIPTS-WEBHOOK] Loading WebEx configuration...');
    const config = await getWebexMeetingsConfig();
    console.log('📝 [TRANSCRIPTS-WEBHOOK] Config loaded:', { enabled: config?.enabled, sitesCount: config?.sites?.length });
    
    if (!config?.enabled || !config.sites?.length) {
      console.warn('📝 [TRANSCRIPTS-WEBHOOK] WebexMeetings not configured or disabled');
      await logWebhookActivity({
        webhookType: 'transcripts',
        siteUrl: 'unknown',
        meetingId: data.meetingId,
        status: 'warning',
        message: 'WebexMeetings integration not configured or disabled',
        databaseAction: 'none',
        s3Upload: false,
        sseNotification: false
      });
      return NextResponse.json({ message: 'WebexMeetings not configured' }, { status: 200 });
    }

    // Find existing recording by meetingId and meetingInstanceId
    const tableName = getTableName('WebexMeetingsRecordings');
    const getCommand = new GetCommand({
      TableName: tableName,
      Key: { id: data.meetingId }
    });
    
    let recording;
    try {
      const result = await docClient.send(getCommand);
      recording = result.Item;
    } catch (error) {
      console.log('📝 [TRANSCRIPTS-WEBHOOK] Recording not found by meetingId, transcript may be orphaned');
      await logWebhookActivity({
        webhookType: 'transcripts',
        siteUrl: 'unknown',
        meetingId: data.meetingId,
        status: 'warning',
        message: 'No matching recording found for transcript',
        processingDetails: 'Recording lookup failed',
        databaseAction: 'none',
        s3Upload: false,
        sseNotification: false
      });
      return NextResponse.json({ message: 'No matching recording found' }, { status: 200 });
    }

    if (!recording || recording.meetingInstanceId !== data.meetingInstanceId) {
      console.warn('📝 [TRANSCRIPTS-WEBHOOK] No matching recording found:', { 
        recordingFound: !!recording, 
        expectedInstanceId: data.meetingInstanceId,
        actualInstanceId: recording?.meetingInstanceId 
      });
      await logWebhookActivity({
        webhookType: 'transcripts',
        siteUrl: recording?.siteUrl || 'unknown',
        meetingId: data.meetingId,
        status: 'warning',
        message: 'No matching recording found for transcript',
        processingDetails: `Expected instance ID: ${data.meetingInstanceId}, Found: ${recording?.meetingInstanceId}`,
        databaseAction: 'none',
        s3Upload: false,
        sseNotification: false
      });
      return NextResponse.json({ message: 'No matching recording found' }, { status: 200 });
    }
    
    console.log('📝 [TRANSCRIPTS-WEBHOOK] Found matching recording:', recording.id);
    console.log('📝 [TRANSCRIPTS-WEBHOOK] Recording host:', recording.hostUserId, recording.hostEmail);

    // Check if this recording is from a configured host (filter at processing level)
    let matchingSite = null;
    let isConfiguredHost = false;
    
    for (const site of config.sites) {
      if (site.recordingHosts.some(host => host.userId === recording.hostUserId)) {
        matchingSite = site;
        isConfiguredHost = true;
        break;
      }
    }
    
    if (!isConfiguredHost) {
      console.log('📝 [TRANSCRIPTS-WEBHOOK] Skipping transcript - not from configured host:', recording.hostUserId);
      await logWebhookActivity({
        webhookType: 'transcripts',
        siteUrl: recording.siteUrl,
        meetingId: data.meetingId,
        status: 'skipped',
        message: 'Transcript not from configured recording host',
        processingDetails: `Host ${recording.hostUserId} not in configured hosts`,
        databaseAction: 'none',
        s3Upload: false,
        sseNotification: false
      });
      return NextResponse.json({ message: 'Transcript skipped - not from configured host' }, { status: 200 });
    }

    // Get valid access token for the site
    console.log('📝 [TRANSCRIPTS-WEBHOOK] Getting valid access token for site:', matchingSite.siteUrl);
    const { getValidAccessToken } = await import('../../../../../lib/webex-token-manager.js');
    const validAccessToken = await getValidAccessToken(matchingSite.siteUrl);
    
    if (!validAccessToken) {
      throw new Error(`No valid access token available for site: ${matchingSite.siteUrl}`);
    }

    // Download transcript
    console.log('📝 [TRANSCRIPTS-WEBHOOK] Downloading transcript from:', data.downloadUrl);
    const transcriptResponse = await fetch(data.downloadUrl, {
      headers: { 'Authorization': `Bearer ${validAccessToken}` }
    });
    console.log('📝 [TRANSCRIPTS-WEBHOOK] Transcript download response:', transcriptResponse.status);
    
    if (!transcriptResponse.ok) {
      throw new Error('Failed to download transcript');
    }
    
    const transcriptBuffer = await transcriptResponse.arrayBuffer();
    const transcriptS3Key = `webexmeetings-transcripts/${data.id}.vtt`;
    
    // Upload transcript to S3
    const s3Command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: transcriptS3Key,
      Body: transcriptBuffer,
      ContentType: 'text/vtt'
    });
    await s3Client.send(s3Command);

    // Update recording with transcript information
    const updatedRecording = {
      ...recording,
      transcriptId: data.id,
      transcriptS3Key,
      transcriptS3Url: `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${transcriptS3Key}`,
      status: 'completed',
      updated_at: new Date().toISOString()
    };

    const putCommand = new PutCommand({
      TableName: tableName,
      Item: updatedRecording
    });
    await docClient.send(putCommand);
    console.log('📝 [TRANSCRIPTS-WEBHOOK] Recording updated with transcript info');

    // Send SSE notification for transcript update
    try {
      const { notifyWebexRecordingsUpdate } = await import('../../../sse/webex-meetings/route.js');
      notifyWebexRecordingsUpdate({
        type: 'transcript_updated',
        recordingId: recording.id,
        timestamp: Date.now()
      });
    } catch (sseError) {
      console.error('Failed to send SSE notification for transcript update:', sseError);
    }

    console.log('📝 [TRANSCRIPTS-WEBHOOK] Processing completed successfully');
    await logWebhookActivity({
      webhookType: 'transcripts',
      siteUrl: recording.siteUrl,
      meetingId: data.meetingId,
      status: 'success',
      message: 'Transcript processed successfully',
      processingDetails: `Downloaded and uploaded to S3: ${transcriptS3Key}`,
      databaseAction: 'updated',
      s3Upload: true,
      sseNotification: true
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('📝 [TRANSCRIPTS-WEBHOOK] Processing failed:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    await logWebhookActivity({
      webhookType: 'transcripts',
      siteUrl: webhookData?.siteUrl || 'unknown',
      meetingId: webhookData?.meetingId || 'unknown',
      status: 'error',
      message: 'Transcript processing failed',
      error: error.message,
      processingDetails: error.stack,
      databaseAction: 'none',
      s3Upload: false,
      sseNotification: false
    });
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}