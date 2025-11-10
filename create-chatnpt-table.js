import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { getEnvironment } from './lib/dynamodb.js';

const client = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const env = getEnvironment();

async function createTable() {
  const tableName = `PracticeTools-${env}-ChatNPTHistory`;
  
  try {
    const command = new CreateTableCommand({
      TableName: tableName,
      KeySchema: [
        { AttributeName: 'userEmail', KeyType: 'HASH' },
        { AttributeName: 'chatId', KeyType: 'RANGE' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'userEmail', AttributeType: 'S' },
        { AttributeName: 'chatId', AttributeType: 'S' }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    });

    await client.send(command);
    console.log(`✅ Table ${tableName} created successfully`);
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log(`✅ Table ${tableName} already exists`);
    } else {
      console.error('❌ Error creating table:', error);
      process.exit(1);
    }
  }
}

createTable();
