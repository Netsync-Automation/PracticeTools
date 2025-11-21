import { NextResponse } from 'next/server';
import { getTableName } from '../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export async function GET() {
  try {
    const tableName = getTableName('WebexMeetingsRecordings');
    
    const command = new ScanCommand({
      TableName: tableName
    });
    
    const result = await docClient.send(command);
    const recordings = (result.Items || []).map(item => ({
      id: item.id,
      meetingId: item.meetingId,
      hostUserId: item.hostUserId,
      hostEmail: item.hostEmail,
      topic: item.topic,
      createTime: item.createTime,
      s3Url: item.s3Url,
      downloadUrl: item.downloadUrl,
      transcriptStatus: item.transcriptFailed ? 'failed' : (item.transcriptText ? 'available' : 'pending'),
      transcriptS3Url: item.transcriptS3Url || null,
      status: item.status,
      approved: item.approved || false,
      approvedAt: item.approvedAt || null,
      denied: item.denied || false,
      deniedAt: item.deniedAt || null,
      created_at: item.created_at,
      updated_at: item.updated_at
    }));

    // Sort by creation time, newest first
    recordings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return NextResponse.json({ recordings });
  } catch (error) {
    console.error('Error fetching WebEx recordings:', error);
    return NextResponse.json({ error: 'Failed to fetch recordings' }, { status: 500 });
  }
}