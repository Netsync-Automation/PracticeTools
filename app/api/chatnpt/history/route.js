import { NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getTableName } from '../../../../lib/dynamodb';
import { v4 as uuidv4 } from 'uuid';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');
    
    if (!userEmail) {
      return NextResponse.json({ error: 'User email required' }, { status: 400 });
    }

    const tableName = getTableName('ChatNPTHistory');
    const command = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'userEmail = :email',
      ExpressionAttributeValues: {
        ':email': userEmail
      },
      ScanIndexForward: false
    });
    
    const result = await docClient.send(command);
    return NextResponse.json({ chats: result.Items || [] });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return NextResponse.json({ error: 'Failed to fetch chat history' }, { status: 500 });
  }
}

function summarizeTitle(text) {
  if (!text) return 'New Chat';
  
  // Remove common question words and clean up
  const cleaned = text
    .replace(/^(what|how|why|when|where|who|can|could|would|should|is|are|do|does|did|tell me|explain|show me)\s+/i, '')
    .replace(/\?+$/, '')
    .trim();
  
  // Take first 50 chars and capitalize first letter
  const summary = cleaned.substring(0, 50);
  return summary.charAt(0).toUpperCase() + summary.slice(1) + (cleaned.length > 50 ? '...' : '');
}

export async function POST(request) {
  try {
    const { userEmail, title, messages } = await request.json();
    
    if (!userEmail) {
      return NextResponse.json({ error: 'User email required' }, { status: 400 });
    }

    const chatId = uuidv4();
    const tableName = getTableName('ChatNPTHistory');
    const now = new Date().toISOString();
    const firstMessage = messages?.[0]?.content || '';
    const chatTitle = title || summarizeTitle(firstMessage);
    
    const command = new PutCommand({
      TableName: tableName,
      Item: {
        userEmail,
        chatId,
        title: chatTitle,
        messages: messages || [],
        created_at: now,
        updated_at: now
      }
    });
    
    await docClient.send(command);
    return NextResponse.json({ chatId, title: chatTitle });
  } catch (error) {
    console.error('Error creating chat:', error);
    return NextResponse.json({ error: 'Failed to create chat' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { userEmail, chatId, messages, title } = await request.json();
    
    if (!userEmail || !chatId) {
      return NextResponse.json({ error: 'User email and chat ID required' }, { status: 400 });
    }

    const tableName = getTableName('ChatNPTHistory');
    let updateExpression = 'SET updated_at = :updated';
    const expressionValues = { ':updated': new Date().toISOString() };
    
    if (messages) {
      updateExpression += ', messages = :messages';
      expressionValues[':messages'] = messages;
    }
    
    if (title) {
      updateExpression += ', title = :title';
      expressionValues[':title'] = title;
    }
    
    const command = new UpdateCommand({
      TableName: tableName,
      Key: { userEmail, chatId },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionValues
    });
    
    await docClient.send(command);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating chat:', error);
    return NextResponse.json({ error: 'Failed to update chat' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');
    const chatId = searchParams.get('chatId');
    
    if (!userEmail || !chatId) {
      return NextResponse.json({ error: 'User email and chat ID required' }, { status: 400 });
    }

    const tableName = getTableName('ChatNPTHistory');
    const { DeleteCommand } = await import('@aws-sdk/lib-dynamodb');
    const command = new DeleteCommand({
      TableName: tableName,
      Key: { userEmail, chatId }
    });
    
    await docClient.send(command);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting chat:', error);
    return NextResponse.json({ error: 'Failed to delete chat' }, { status: 500 });
  }
}
