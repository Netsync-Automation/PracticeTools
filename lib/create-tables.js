const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
const { getEnvironment, getTableName } = require('./dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

async function createWebexMeetingsTable() {
  const tableName = getTableName('webex_meetings');
  
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    console.log(`Table ${tableName} already exists`);
    return;
  } catch (error) {
    if (error.name !== 'ResourceNotFoundException') {
      throw error;
    }
  }
  
  const createTableParams = {
    TableName: tableName,
    KeySchema: [
      { AttributeName: 'meetingId', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'meetingId', AttributeType: 'S' }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  };
  
  await client.send(new CreateTableCommand(createTableParams));
  console.log(`Created table ${tableName}`);
}

module.exports = { createWebexMeetingsTable };