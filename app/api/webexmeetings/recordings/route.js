import { NextResponse } from 'next/server';
import { getTableName } from '../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

export async function GET() {
  try {
    const tableName = getTableName('WebexMeetingsRecordings');
    
    const command = new ScanCommand({
      TableName: tableName
    });
    
    const result = await docClient.send(command);
    const recordings = result.Items || [];

    // Generate presigned URLs for downloads
    const recordingsWithUrls = await Promise.all(
      recordings.map(async (recording) => {
        try {
          // Generate presigned URL for recording
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

          return {
            ...recording,
            downloadUrl: recordingUrl,
            transcriptDownloadUrl: transcriptUrl
          };
        } catch (error) {
          console.error('Error generating presigned URL for recording:', recording.id, error);
          return recording;
        }
      })
    );

    return NextResponse.json({
      recordings: recordingsWithUrls.sort((a, b) => 
        new Date(b.createTime) - new Date(a.createTime)
      )
    });
  } catch (error) {
    console.error('Error fetching WebexMeetings recordings:', error);
    return NextResponse.json({ error: 'Failed to fetch recordings' }, { status: 500 });
  }
}