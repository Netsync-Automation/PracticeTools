#!/usr/bin/env node
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getTableName } from './lib/dynamodb.js';

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Get config
const tableName = getTableName('Settings');
const result = await docClient.send(new GetCommand({
  TableName: tableName,
  Key: { setting_key: 'webex-meetings' }
}));

const config = JSON.parse(result.Item.setting_value);

console.log('\n=== Configured Recording Hosts ===');
config.sites.forEach(site => {
  console.log(`\nSite: ${site.siteUrl}`);
  console.log(`Recording Hosts:`);
  site.recordingHosts?.forEach(host => {
    console.log(`  - Email: ${host.email}`);
    console.log(`    User ID: ${host.userId || 'NOT SET'}`);
  });
});

// Get recent webhook logs
const logsTable = getTableName('WebexMeetingsWebhookLogs');
const logsResult = await docClient.send(new ScanCommand({
  TableName: logsTable,
  Limit: 5,
  FilterExpression: 'webhookType = :type',
  ExpressionAttributeValues: { ':type': 'recordings' }
}));

const logs = (logsResult.Items || []).sort((a, b) => 
  new Date(b.timestamp) - new Date(a.timestamp)
);

console.log('\n\n=== Recent Recording Webhook Logs ===');
logs.forEach(log => {
  console.log(`\nTimestamp: ${log.timestamp}`);
  console.log(`Status: ${log.status}`);
  console.log(`Message: ${log.message}`);
  if (log.processingDetails) {
    console.log(`Details: ${log.processingDetails}`);
  }
});
