#!/usr/bin/env node
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getTableName } from './lib/dynamodb.js';

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const tableName = getTableName('Settings');
const result = await docClient.send(new GetCommand({
  TableName: tableName,
  Key: { setting_key: 'webex-meetings' }
}));

const config = JSON.parse(result.Item.setting_value);

console.log('\n=== Full Config Structure ===\n');
console.log(JSON.stringify(config, null, 2));

console.log('\n=== Recording Hosts Detail ===\n');
config.sites.forEach(site => {
  console.log(`Site: ${site.siteUrl}`);
  site.recordingHosts?.forEach((host, idx) => {
    console.log(`\nHost ${idx + 1}:`);
    console.log('  All fields:', Object.keys(host));
    console.log('  Full object:', JSON.stringify(host, null, 2));
  });
});
