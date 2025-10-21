import { NextResponse } from 'next/server';
import { getTableName } from '../../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function logTestWebhook(logData) {
  try {
    const tableName = getTableName('WebexMeetingsWebhookLogs');
    const logEntry = {
      id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      webhookType: 'test',
      status: 'success',
      message: 'Test webhook received',
      ...logData
    };
    
    const command = new PutCommand({
      TableName: tableName,
      Item: logEntry
    });
    await docClient.send(command);
  } catch (error) {
    console.error('Failed to log test webhook:', error);
  }
}

export async function GET(request) {
  console.log('🧪 [TEST-WEBHOOK] GET request received');
  await logTestWebhook({
    siteUrl: 'test-get',
    meetingId: 'test-get',
    processingDetails: `GET request from ${request.headers.get('user-agent')}`,
    databaseAction: 'logged',
    s3Upload: false,
    sseNotification: false
  });
  return NextResponse.json({ message: 'Test webhook GET endpoint working', timestamp: new Date().toISOString() });
}

export async function POST(request) {
  console.log('🧪 [TEST-WEBHOOK] POST request received');
  console.log('🧪 [TEST-WEBHOOK] Headers:', Object.fromEntries(request.headers.entries()));
  
  let body = null;
  try {
    body = await request.json();
    console.log('🧪 [TEST-WEBHOOK] Body:', JSON.stringify(body, null, 2));
  } catch (error) {
    console.log('🧪 [TEST-WEBHOOK] No JSON body or parsing failed');
  }
  
  await logTestWebhook({
    siteUrl: 'test-post',
    meetingId: 'test-post',
    processingDetails: `POST request with body: ${JSON.stringify(body)}`,
    databaseAction: 'logged',
    s3Upload: false,
    sseNotification: false
  });
  
  return NextResponse.json({ 
    message: 'Test webhook POST endpoint working', 
    timestamp: new Date().toISOString(),
    receivedBody: body 
  });
}