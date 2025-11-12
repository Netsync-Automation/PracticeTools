import { NextResponse } from 'next/server';
import { getTableName } from '../../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { validateUserSession } from '../../../../../lib/auth-check';
import { notifyWebexMessagesUpdate } from '../../../sse/webex-messages/route';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const tableName = getTableName('WebexMessages');
    
    const command = new GetCommand({
      TableName: tableName,
      Key: { message_id: id }
    });
    
    const result = await docClient.send(command);
    
    if (!result.Item) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }
    
    return NextResponse.json({ message: result.Item });
  } catch (error) {
    console.error('Error fetching message:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid || !validation.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const { id } = params;
    const tableName = getTableName('WebexMessages');
    
    const command = new DeleteCommand({
      TableName: tableName,
      Key: { message_id: id }
    });
    
    await docClient.send(command);
    notifyWebexMessagesUpdate();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
