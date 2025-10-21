import { NextResponse } from 'next/server';
import { getTableName } from '../../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

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
  try {
    const webhook = await request.json();
    console.log('📝 [TRANSCRIPTS-WEBHOOK] Parsed webhook data:', JSON.stringify(webhook, null, 2));
    const { data } = webhook;
    
    if (!data || webhook.resource !== 'meetingTranscripts') {
      console.error('📝 [TRANSCRIPTS-WEBHOOK] Invalid webhook data:', { data: !!data, resource: webhook.resource });
      return NextResponse.json({ error: 'Invalid webhook data' }, { status: 400 });
    }
    
    console.log('📝 [TRANSCRIPTS-WEBHOOK] Valid transcript webhook received for:', data.id);

    // Get WebexMeetings configuration
    console.log('📝 [TRANSCRIPTS-WEBHOOK] Loading WebEx configuration...');
    const config = await getWebexMeetingsConfig();
    console.log('📝 [TRANSCRIPTS-WEBHOOK] Config loaded:', { enabled: config?.enabled, sitesCount: config?.sites?.length });
    
    if (!config?.enabled || !config.sites?.length) {
      console.warn('📝 [TRANSCRIPTS-WEBHOOK] WebexMeetings not configured or disabled');
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
      // Try to find by scanning for meetingInstanceId if direct lookup fails
      console.log('Recording not found by meetingId, transcript may be orphaned');
      return NextResponse.json({ message: 'No matching recording found' }, { status: 200 });
    }

    if (!recording || recording.meetingInstanceId !== data.meetingInstanceId) {
      console.warn('📝 [TRANSCRIPTS-WEBHOOK] No matching recording found:', { 
        recordingFound: !!recording, 
        expectedInstanceId: data.meetingInstanceId,
        actualInstanceId: recording?.meetingInstanceId 
      });
      return NextResponse.json({ message: 'No matching recording found' }, { status: 200 });
    }
    
    console.log('📝 [TRANSCRIPTS-WEBHOOK] Found matching recording:', recording.id);

    // Find matching site configuration
    const matchingSite = config.sites.find(site => site.siteUrl === recording.siteUrl);
    if (!matchingSite) {
      return NextResponse.json({ message: 'Site configuration not found' }, { status: 200 });
    }

    // Download transcript
    console.log('📝 [TRANSCRIPTS-WEBHOOK] Downloading transcript from:', data.downloadUrl);
    const transcriptResponse = await fetch(data.downloadUrl, {
      headers: { 'Authorization': `Bearer ${matchingSite.accessToken}` }
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
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('📝 [TRANSCRIPTS-WEBHOOK] Processing failed:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}