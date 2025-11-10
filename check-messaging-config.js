import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getTableName } from './lib/dynamodb.js';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function checkMessagingConfig() {
  const tableName = getTableName('Settings');
  console.log('Scanning table:', tableName);
  console.log('');
  
  const command = new ScanCommand({
    TableName: tableName
  });
  
  const result = await docClient.send(command);
  
  console.log('=== ALL SETTINGS ===');
  for (const item of result.Items || []) {
    console.log('\nSetting Key:', item.setting_key);
    if (item.setting_key.includes('message') || item.setting_key.includes('webex')) {
      console.log('Value:', item.setting_value?.substring(0, 200));
    }
  }
}

checkMessagingConfig();
