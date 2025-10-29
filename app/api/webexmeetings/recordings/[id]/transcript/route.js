import { NextResponse } from 'next/server';
import { getTableName } from '../../../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getValidAccessToken } from '../../../../../../lib/webex-token-manager';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const tableName = getTableName('WebexMeetingsRecordings');
    
    const command = new GetCommand({
      TableName: tableName,
      Key: { id }
    });
    
    const result = await docClient.send(command);
    
    if (!result.Item) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }
    
    if (!result.Item.transcriptText) {
      return NextResponse.json({ error: 'Transcript not available' }, { status: 404 });
    }
    
    return NextResponse.json({ 
      transcript: result.Item.transcriptText,
      recordingId: id,
      topic: result.Item.topic
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch transcript' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const tableName = getTableName('WebexMeetingsRecordings');
    
    const getCommand = new GetCommand({
      TableName: tableName,
      Key: { id }
    });
    
    const result = await docClient.send(getCommand);
    
    if (!result.Item) {
      return NextResponse.json({ error: 'Recording not found' }, { status: 404 });
    }
    
    const recording = result.Item;
    
    if (recording.transcriptText) {
      return NextResponse.json({ message: 'Transcript already exists' });
    }
    
    const accessToken = await getValidAccessToken(recording.siteUrl);
    
    const recordingResponse = await fetch(
      `https://webexapis.com/v1/recordings/${id}?hostEmail=${encodeURIComponent(recording.hostEmail)}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    
    if (!recordingResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch recording details' }, { status: 500 });
    }
    
    const recordingDetails = await recordingResponse.json();
    const transcriptLink = recordingDetails.temporaryDirectDownloadLinks?.transcriptDownloadLink;
    
    if (!transcriptLink) {
      const retryCount = (recording.transcriptRetryCount || 0) + 1;
      const maxRetries = 288;
      
      if (retryCount >= maxRetries) {
        const updateCommand = new PutCommand({
          TableName: tableName,
          Item: {
            ...recording,
            transcriptRetryCount: retryCount,
            updated_at: new Date().toISOString()
          }
        });
        await docClient.send(updateCommand);
        
        const { notifyWebexRecordingsUpdate } = await import('../../../../sse/webex-meetings/route.js');
        notifyWebexRecordingsUpdate({ type: 'transcript_updated', recordingId: id, timestamp: Date.now() });
        
        return NextResponse.json({ message: 'Max retries reached, transcript not available' });
      }
      
      const updateCommand = new PutCommand({
        TableName: tableName,
        Item: {
          ...recording,
          transcriptRetryCount: retryCount,
          nextTranscriptRetry: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString()
        }
      });
      await docClient.send(updateCommand);
      
      return NextResponse.json({ message: 'Transcript not available yet, will retry' });
    }
    
    const transcriptResponse = await fetch(transcriptLink, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!transcriptResponse.ok) {
      return NextResponse.json({ error: 'Failed to download transcript' }, { status: 500 });
    }
    
    const transcriptText = await transcriptResponse.text();
    
    const s3Key = `webexmeetings-transcripts/${id}.vtt`;
    const s3Command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: s3Key,
      Body: transcriptText,
      ContentType: 'text/vtt'
    });
    await s3Client.send(s3Command);
    
    const updateCommand = new PutCommand({
      TableName: tableName,
      Item: {
        ...recording,
        transcriptText,
        transcriptS3Key: s3Key,
        transcriptS3Url: `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${s3Key}`,
        transcriptRetryCount: recording.transcriptRetryCount || 0,
        updated_at: new Date().toISOString()
      }
    });
    await docClient.send(updateCommand);
    
    const { notifyWebexRecordingsUpdate } = await import('../../../../sse/webex-meetings/route.js');
    notifyWebexRecordingsUpdate({ type: 'transcript_updated', recordingId: id, timestamp: Date.now() });
    
    return NextResponse.json({ success: true, message: 'Transcript fetched successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process transcript' }, { status: 500 });
  }
}
