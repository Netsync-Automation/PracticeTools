import { NextResponse } from 'next/server';
import { getTableName } from '../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
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

export async function POST() {
  try {
    const config = await getWebexMeetingsConfig();
    if (!config?.enabled || !config.sites?.length) {
      return NextResponse.json({ error: 'WebexMeetings not configured' }, { status: 400 });
    }

    const tableName = getTableName('WebexMeetingsRecordings');
    const scanCommand = new ScanCommand({
      TableName: tableName,
      FilterExpression: 'attribute_not_exists(transcriptId) AND #status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': 'processing' }
    });

    const result = await docClient.send(scanCommand);
    const recordingsWithoutTranscripts = result.Items || [];
    let processedCount = 0;

    for (const recording of recordingsWithoutTranscripts) {
      const matchingSite = config.sites.find(site => site.siteUrl === recording.siteUrl);
      if (!matchingSite) continue;

      try {
        const transcriptResponse = await fetch(
          `${recording.siteUrl}/v1/meetingTranscripts?meetingId=${recording.meetingId}`,
          { headers: { 'Authorization': `Bearer ${matchingSite.accessToken}` } }
        );

        if (transcriptResponse.ok) {
          const transcripts = await transcriptResponse.json();
          const matchingTranscript = transcripts.items?.find(t => 
            t.meetingInstanceId === recording.meetingInstanceId
          );

          if (matchingTranscript) {
            await processTranscript(matchingTranscript, recording, matchingSite.accessToken);
            processedCount++;
          }
        }
      } catch (error) {
        console.error(`Error fetching transcript for recording ${recording.id}:`, error);
      }
    }

    return NextResponse.json({ 
      success: true, 
      processedCount,
      totalChecked: recordingsWithoutTranscripts.length 
    });
  } catch (error) {
    console.error('Error fetching WebexMeetings transcripts:', error);
    return NextResponse.json({ error: 'Failed to fetch transcripts' }, { status: 500 });
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
    
    const s3Command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: transcriptS3Key,
      Body: transcriptBuffer,
      ContentType: 'text/vtt'
    });
    await s3Client.send(s3Command);

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
  } catch (error) {
    console.error('Error processing transcript:', error);
  }
}