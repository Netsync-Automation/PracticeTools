import { DynamoDBClient, CreateTableCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({ region: 'us-east-1' });

async function createTable(tableName) {
  try {
    await client.send(new CreateTableCommand({
      TableName: tableName,
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
      BillingMode: 'PAY_PER_REQUEST'
    }));
    console.log(`✓ Created table: ${tableName}`);
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log(`✓ Table already exists: ${tableName}`);
    } else {
      console.error(`✗ Error creating ${tableName}:`, error.message);
    }
  }
}

async function main() {
  await createTable('PracticeTools-dev-Documentation');
  await createTable('PracticeTools-prod-Documentation');
}

main();
