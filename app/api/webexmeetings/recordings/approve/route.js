import { NextResponse } from 'next/server';
import { getTableName } from '../../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { notifyWebexRecordingsUpdate } from '../../../sse/webex-meetings/route';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export async function POST(request) {
  try {
    const { recordingIds } = await request.json();
    
    if (!recordingIds || !Array.isArray(recordingIds) || recordingIds.length === 0) {
      return NextResponse.json({ error: 'Invalid recording IDs' }, { status: 400 });
    }

    const tableName = getTableName('WebexMeetingsRecordings');
    const now = new Date().toISOString();
    const approved = [];
    const rejected = [];

    for (const id of recordingIds) {
      const getCommand = new GetCommand({
        TableName: tableName,
        Key: { id }
      });
      const { Item } = await docClient.send(getCommand);
      
      if (!Item?.transcriptText) {
        rejected.push(id);
        continue;
      }
      
      const command = new UpdateCommand({
        TableName: tableName,
        Key: { id },
        UpdateExpression: 'SET approved = :approved, approvedAt = :approvedAt, updated_at = :updated_at',
        ExpressionAttributeValues: {
          ':approved': true,
          ':approvedAt': now,
          ':updated_at': now
        }
      });
      await docClient.send(command);
      approved.push(id);
    }

    notifyWebexRecordingsUpdate();

    if (rejected.length > 0) {
      return NextResponse.json({ 
        success: true, 
        approved: approved.length,
        rejected: rejected.length,
        message: `${approved.length} recording(s) approved. ${rejected.length} recording(s) rejected (no transcript available).` 
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: `${approved.length} recording(s) approved` 
    });
  } catch (error) {
    console.error('Error approving recordings:', error);
    return NextResponse.json({ error: 'Failed to approve recordings' }, { status: 500 });
  }
}
