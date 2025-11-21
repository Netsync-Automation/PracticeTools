#!/usr/bin/env node
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getTableName } from './lib/dynamodb.js';

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const logsTable = getTableName('WebexMeetingsWebhookLogs');
const logsResult = await docClient.send(new ScanCommand({
  TableName: logsTable,
  FilterExpression: 'webhookType = :type',
  ExpressionAttributeValues: { ':type': 'recordings' }
}));

const logs = (logsResult.Items || []).sort((a, b) => 
  new Date(b.timestamp) - new Date(a.timestamp)
);

console.log('\n=== Most Recent Recording Webhook Log (FULL DETAILS) ===\n');
if (logs.length > 0) {
  const log = logs[0];
  console.log('Log ID:', log.logId);
  console.log('Timestamp:', log.timestamp);
  console.log('Status:', log.status);
  console.log('Message:', log.message);
  console.log('\nProcessing Details:', log.processingDetails);
  
  if (log.recordingData) {
    console.log('\n=== Recording Data from Webhook ===');
    console.log(JSON.stringify(log.recordingData, null, 2));
  }
  
  if (log.webhookPayload) {
    console.log('\n=== Full Webhook Payload ===');
    console.log(JSON.stringify(log.webhookPayload, null, 2));
  }
} else {
  console.log('No recording webhook logs found');
}
