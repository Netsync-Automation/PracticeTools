import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({ region: 'us-east-1' });

async function createTable(tableName) {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    console.log(`✓ Table ${tableName} already exists`);
    return;
  } catch (error) {
    if (error.name !== 'ResourceNotFoundException') throw error;
  }

  const command = new CreateTableCommand({
    TableName: tableName,
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'timestamp', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [{
      IndexName: 'timestamp-index',
      KeySchema: [{ AttributeName: 'timestamp', KeyType: 'HASH' }],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    }],
    BillingMode: 'PROVISIONED',
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
  });

  await client.send(command);
  console.log(`✓ Created table ${tableName}`);
}

async function main() {
  console.log('Creating WebexMeetingsWebhookLogs tables...\n');
  
  await createTable('PracticeTools-dev-WebexMeetingsWebhookLogs');
  await createTable('PracticeTools-prod-WebexMeetingsWebhookLogs');
  
  console.log('\n✓ All tables created successfully');
}

main().catch(console.error);
