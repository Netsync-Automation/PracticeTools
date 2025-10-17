import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { getEnvironment, getTableName } from './dynamodb.js';

const client = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

async function ensureTableExists(tableName, keySchema, attributeDefinitions) {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    return true;
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      try {
        await client.send(new CreateTableCommand({
          TableName: tableName,
          KeySchema: keySchema,
          AttributeDefinitions: attributeDefinitions,
          BillingMode: 'PAY_PER_REQUEST'
        }));
        return true;
      } catch (createError) {
        console.error(`Failed to create table ${tableName}:`, createError);
        return false;
      }
    }
    console.error(`Error checking table ${tableName}:`, error);
    return false;
  }
}

export async function createWebexMeetingsTable() {
  const tableName = getTableName('webex_meetings');
  return ensureTableExists(tableName, 
    [{ AttributeName: 'meetingId', KeyType: 'HASH' }],
    [{ AttributeName: 'meetingId', AttributeType: 'S' }]
  );
}

export async function createWebexHostsTable() {
  const tableName = getTableName('webex_hosts');
  return ensureTableExists(tableName,
    [{ AttributeName: 'email', KeyType: 'HASH' }],
    [{ AttributeName: 'email', AttributeType: 'S' }]
  );
}

export async function createWebexLogsTable() {
  const tableName = getTableName('webex_logs');
  return ensureTableExists(tableName,
    [{ AttributeName: 'id', KeyType: 'HASH' }],
    [{ AttributeName: 'id', AttributeType: 'S' }]
  );
}