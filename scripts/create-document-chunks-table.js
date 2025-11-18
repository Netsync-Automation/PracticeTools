import { DynamoDBClient, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { getEnvironment, getTableName } from '../lib/dynamodb.js';

const dynamodb = new DynamoDBClient({ region: 'us-east-1' });

async function createTable() {
  const env = getEnvironment();
  const tableName = `PracticeTools-${env}-DocumentChunks`;
  
  const params = {
    TableName: tableName,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      {
        AttributeName: 'pk',
        AttributeType: 'S'
      },
      {
        AttributeName: 'sk',
        AttributeType: 'S'
      },
      {
        AttributeName: 'tenantId',
        AttributeType: 'S'
      }
    ],
    KeySchema: [
      {
        AttributeName: 'pk',
        KeyType: 'HASH'
      },
      {
        AttributeName: 'sk',
        KeyType: 'RANGE'
      }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'TenantIndex',
        KeySchema: [
          {
            AttributeName: 'tenantId',
            KeyType: 'HASH'
          }
        ],
        Projection: {
          ProjectionType: 'ALL'
        }
      }
    ]
  };
  
  try {
    const result = await dynamodb.send(new CreateTableCommand(params));
    console.log(`DocumentChunks table created successfully for ${env}:`, result.TableDescription.TableName);
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log(`DocumentChunks table already exists for ${env}`);
    } else {
      console.error('Error creating table:', error);
      throw error;
    }
  }
}

// Create tables for both environments
async function createBothTables() {
  console.log('Creating DocumentChunks tables for both environments...');
  
  // Create dev table
  process.env.ENVIRONMENT = 'dev';
  console.log('\n=== Creating DEV table ===');
  await createTable();
  
  // Create prod table
  process.env.ENVIRONMENT = 'prod';
  console.log('\n=== Creating PROD table ===');
  await createTable();
  
  console.log('\nAll tables created successfully!');
}

createBothTables().catch(console.error);