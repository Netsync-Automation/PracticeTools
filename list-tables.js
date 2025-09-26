import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

async function listTables() {
  try {
    const command = new ListTablesCommand({});
    const result = await client.send(command);
    
    console.log('Available DynamoDB tables:');
    for (const tableName of result.TableNames || []) {
      console.log(`- ${tableName}`);
    }
  } catch (error) {
    console.error('Error listing tables:', error);
  }
}

listTables();