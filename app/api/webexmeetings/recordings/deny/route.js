import { NextResponse } from 'next/server';
import { getTableName } from '../../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { notifyWebexRecordingsUpdate } from '../../../sse/webex-meetings/route';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export async function POST(request) {
  try {
    const { recordingIds } = await request.json();
    console.log('[DENY] Received request for:', recordingIds);
    
    if (!recordingIds || !Array.isArray(recordingIds) || recordingIds.length === 0) {
      return NextResponse.json({ error: 'Invalid recording IDs' }, { status: 400 });
    }

    const tableName = getTableName('WebexMeetingsRecordings');
    const now = new Date().toISOString();

    for (const id of recordingIds) {
      console.log('[DENY] Updating recording:', id);
      const command = new UpdateCommand({
        TableName: tableName,
        Key: { id },
        UpdateExpression: 'SET denied = :denied, deniedAt = :deniedAt, approved = :approved, updated_at = :updated_at REMOVE approvedAt',
        ExpressionAttributeValues: {
          ':denied': true,
          ':deniedAt': now,
          ':approved': false,
          ':updated_at': now
        }
      });
      await docClient.send(command);
      console.log('[DENY] Updated recording:', id);
    }

    console.log('[DENY] Sending SSE notification...');
    notifyWebexRecordingsUpdate();
    console.log('[DENY] SSE notification sent');

    return NextResponse.json({ 
      success: true, 
      message: `${recordingIds.length} recording(s) denied` 
    });
  } catch (error) {
    console.error('Error denying recordings:', error);
    return NextResponse.json({ error: 'Failed to deny recordings' }, { status: 500 });
  }
}
