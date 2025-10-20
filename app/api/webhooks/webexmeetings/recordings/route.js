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
  const command = new GetCommand({
    TableName: tableName,
    Key: { id: 'webex-meetings' }
  });
  const result = await docClient.send(command);
  return result.Item;
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
  try {
    const webhook = await request.json();
    const { data } = webhook;
    
    if (!data || webhook.resource !== 'recordings') {
      return NextResponse.json({ error: 'Invalid webhook data' }, { status: 400 });
    }

    // Get WebexMeetings configuration
    const config = await getWebexMeetingsConfig();
    if (!config?.enabled || !config.sites?.length) {
      return NextResponse.json({ message: 'WebexMeetings not configured' }, { status: 200 });
    }

    // Find matching site configuration
    const matchingSite = config.sites.find(site => 
      data.siteUrl === site.siteUrl && 
      site.recordingHosts.includes(data.hostUserId)
    );

    if (!matchingSite) {
      return NextResponse.json({ message: 'Recording not from configured host/site' }, { status: 200 });
    }

    // Download recording
    const recordingBuffer = await downloadRecording(data.downloadUrl, matchingSite.accessToken);
    
    // Upload to S3
    const s3Key = `webexmeetings-recordings/${data.id}.mp4`;
    await uploadToS3(recordingBuffer, s3Key);

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

    // Send SSE notification for new recording
    try {
      const { notifyWebexRecordingsUpdate } = await import('../../sse/webex-meetings/route.js');
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('WebexMeetings recording webhook error:', error);
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
      const { notifyWebexRecordingsUpdate } = await import('../../sse/webex-meetings/route.js');
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