import { NextResponse } from 'next/server';
import { getTableName } from '../../../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

export async function GET(request, { params }) {
  try {
    const { id } = params;
    
    // Get recording from database
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
    
    // Get file from S3
    const s3Command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: recording.s3Key
    });
    
    const s3Response = await s3Client.send(s3Command);
    
    // Stream the file back to user
    const headers = new Headers();
    headers.set('Content-Type', 'video/mp4');
    headers.set('Content-Disposition', `attachment; filename="${recording.topic || 'recording'}.mp4"`);
    headers.set('Content-Length', s3Response.ContentLength?.toString() || '0');
    
    return new NextResponse(s3Response.Body, { headers });
    
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}