import { NextResponse } from 'next/server';
import { getTableName } from '../../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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

    const recording = result.Item;

    // Generate presigned URL for recording download
    const recordingCommand = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: recording.s3Key
    });
    const recordingUrl = await getSignedUrl(s3Client, recordingCommand, { expiresIn: 3600 });

    let transcriptUrl = null;
    if (recording.transcriptS3Key) {
      const transcriptCommand = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: recording.transcriptS3Key
      });
      transcriptUrl = await getSignedUrl(s3Client, transcriptCommand, { expiresIn: 3600 });
    }

    return NextResponse.json({
      ...recording,
      downloadUrl: recordingUrl,
      transcriptDownloadUrl: transcriptUrl
    });
  } catch (error) {
    console.error('Error fetching WebexMeetings recording:', error);
    return NextResponse.json({ error: 'Failed to fetch recording' }, { status: 500 });
  }
}