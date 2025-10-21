import { NextResponse } from 'next/server';
import { getTableName } from '../../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

async function getWebexMeetingsConfig() {
  const tableName = getTableName('Settings');
  console.log('🎥 [RECORDINGS-WEBHOOK] Loading config from table:', tableName);
  const command = new GetCommand({
    TableName: tableName,
    Key: { setting_key: 'webex-meetings' }
  });
  const result = await docClient.send(command);
  console.log('🎥 [RECORDINGS-WEBHOOK] Raw config result:', result.Item);
  const config = result.Item?.setting_value ? JSON.parse(result.Item.setting_value) : null;
  console.log('🎥 [RECORDINGS-WEBHOOK] Parsed config:', config);
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
  console.log('🎥 [RECORDINGS-WEBHOOK] Received webhook request');
  console.log('🎥 [RECORDINGS-WEBHOOK] Request headers:', Object.fromEntries(request.headers.entries()));
  console.log('🎥 [RECORDINGS-WEBHOOK] Request method:', request.method);
  console.log('🎥 [RECORDINGS-WEBHOOK] Request URL:', request.url);
  try {
    const webhook = await request.json();
    console.log('🎥 [RECORDINGS-WEBHOOK] Parsed webhook data:', JSON.stringify(webhook, null, 2));
    const { data } = webhook;
    
    if (!data || webhook.resource !== 'recordings') {
      console.error('🎥 [RECORDINGS-WEBHOOK] Invalid webhook data:', { data: !!data, resource: webhook.resource });
      return NextResponse.json({ error: 'Invalid webhook data' }, { status: 400 });
    }
    
    console.log('🎥 [RECORDINGS-WEBHOOK] Valid recordings webhook received for:', data.id);

    // Get WebexMeetings configuration
    console.log('🎥 [RECORDINGS-WEBHOOK] Loading WebEx configuration...');
    const config = await getWebexMeetingsConfig();
    console.log('🎥 [RECORDINGS-WEBHOOK] Config loaded:', { enabled: config?.enabled, sitesCount: config?.sites?.length });
    
    if (!config?.enabled || !config.sites?.length) {
      console.warn('🎥 [RECORDINGS-WEBHOOK] WebexMeetings not configured or disabled');
      return NextResponse.json({ message: 'WebexMeetings not configured' }, { status: 200 });
    }

    // Find matching site configuration
    console.log('🎥 [RECORDINGS-WEBHOOK] Looking for matching site:', { siteUrl: data.siteUrl, hostUserId: data.hostUserId });
    console.log('🎥 [RECORDINGS-WEBHOOK] Available sites:', config.sites.map(s => ({ siteUrl: s.siteUrl, hosts: s.recordingHosts })));
    
    const matchingSite = config.sites.find(site => 
      data.siteUrl === site.siteUrl && 
      site.recordingHosts.includes(data.hostUserId)
    );

    if (!matchingSite) {
      console.warn('🎥 [RECORDINGS-WEBHOOK] No matching site/host found');
      return NextResponse.json({ message: 'Recording not from configured host/site' }, { status: 200 });
    }
    
    console.log('🎥 [RECORDINGS-WEBHOOK] Found matching site:', matchingSite.siteUrl);

    // Download recording
    console.log('🎥 [RECORDINGS-WEBHOOK] Downloading recording from:', data.downloadUrl);
    const recordingBuffer = await downloadRecording(data.downloadUrl, matchingSite.accessToken);
    console.log('🎥 [RECORDINGS-WEBHOOK] Recording downloaded, size:', recordingBuffer.byteLength, 'bytes');
    
    // Upload to S3
    const s3Key = `webexmeetings-recordings/${data.id}.mp4`;
    console.log('🎥 [RECORDINGS-WEBHOOK] Uploading to S3:', s3Key);
    await uploadToS3(recordingBuffer, s3Key);
    console.log('🎥 [RECORDINGS-WEBHOOK] S3 upload completed');

    // Store in DynamoDB
    const tableName = getTableName('WebexMeetingsRecordings');
    const recordingData = {
      id: data.id,
      meetingId: data.meetingId,
      meetingInstanceId: data.meetingInstanceId,
      hostUserId: data.hostUserId,
      siteUrl: data.siteUrl,
      topic: data.topic || 'Untitled Meeting',
      createTime: data.createTime,
      s3Key,
      s3Url: `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${s3Key}`,
      status: 'processing',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const putCommand = new PutCommand({
      TableName: tableName,
      Item: recordingData
    });
    await docClient.send(putCommand);
    console.log('🎥 [RECORDINGS-WEBHOOK] Recording data saved to DynamoDB');

    // Send SSE notification for new recording
    try {
      const { notifyWebexRecordingsUpdate } = await import('../../../sse/webex-meetings/route.js');
      notifyWebexRecordingsUpdate({
        type: 'recording_added',
        recording: recordingData,
        timestamp: Date.now()
      });
    } catch (sseError) {
      console.error('Failed to send SSE notification for new recording:', sseError);
    }

    // Try to get transcript immediately
    try {
      const transcriptResponse = await fetch(
        `${data.siteUrl}/v1/meetingTranscripts?meetingId=${data.meetingId}`,
        { headers: { 'Authorization': `Bearer ${matchingSite.accessToken}` } }
      );
      
      if (transcriptResponse.ok) {
        const transcripts = await transcriptResponse.json();
        if (transcripts.items?.length > 0) {
          const transcript = transcripts.items[0];
          await processTranscript(transcript, recordingData, matchingSite.accessToken);
        }
      }
    } catch (error) {
      console.log('Transcript not immediately available:', error.message);
    }

    console.log('🎥 [RECORDINGS-WEBHOOK] Processing completed successfully');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('🎥 [RECORDINGS-WEBHOOK] Processing failed:', {
      message: error.message,
      stack: error.stack,
      name: error.name
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
      notifyWebexRecordingsUpdate({
        type: 'transcript_updated',
        recordingId: recording.id,
        timestamp: Date.now()
      });
    } catch (sseError) {
      console.error('Failed to send SSE notification for transcript update:', sseError);
    }
  } catch (error) {
    console.error('WebexMeetings transcript processing error:', error);
  }
}