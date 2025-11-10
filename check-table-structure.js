import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({ region: 'us-east-1' });

async function checkTable(tableName) {
  try {
    const result = await client.send(new DescribeTableCommand({ TableName: tableName }));
    console.log(`\n=== ${tableName} ===`);
    console.log('Key Schema:', JSON.stringify(result.Table.KeySchema, null, 2));
    console.log('Attribute Definitions:', JSON.stringify(result.Table.AttributeDefinitions, null, 2));
    console.log('Global Secondary Indexes:', JSON.stringify(result.Table.GlobalSecondaryIndexes, null, 2));
    console.log('Table Status:', result.Table.TableStatus);
  } catch (error) {
    console.error(`Error checking ${tableName}:`, error.message);
  }
}

async function main() {
  await checkTable('PracticeTools-dev-WebexMessages');
  await checkTable('PracticeTools-dev-WebexMeetingsWebhookLogs');
}

main().catch(console.error);
