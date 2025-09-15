import { DynamoDBClient, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { getTableName, getEnvironment } from '../lib/dynamodb.js';

const client = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const PRACTICE_OPTIONS = [
  'Audio/Visual',
  'Collaboration',
  'Contact Center',
  'CX',
  'Cyber Security',
  'Data Center',
  'Enterprise Networking',
  'IoT',
  'Pending',
  'Physical Security',
  'Project Management',
  'WAN/Optical',
  'Wireless'
];

async function seedPracticeOptions() {
  const tableName = getTableName('PracticeOptions');
  const environment = getEnvironment();
  
  console.log(`Seeding practice options for environment: ${environment}`);
  console.log(`Using table: ${tableName}`);
  
  // Ensure table exists first
  try {
    const createCommand = new CreateTableCommand({
      TableName: tableName,
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
      BillingMode: 'PAY_PER_REQUEST'
    });
    
    await client.send(createCommand);
    console.log(`✓ Created table: ${tableName}`);
    
    // Wait for table to be active
    await new Promise(resolve => setTimeout(resolve, 3000));
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log(`✓ Table already exists: ${tableName}`);
    } else {
      console.error(`✗ Failed to create table:`, error.message);
      return;
    }
  }
  
  for (const practice of PRACTICE_OPTIONS) {
    try {
      const command = new PutCommand({
        TableName: tableName,
        Item: {
          id: practice,
          name: practice,
          created_at: new Date().toISOString()
        }
      });
      
      await docClient.send(command);
      console.log(`✓ Added practice: ${practice}`);
    } catch (error) {
      console.error(`✗ Failed to add practice ${practice}:`, error.message);
    }
  }
  
  console.log('Practice options seeding completed');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('seed-practice-options.js')) {
  seedPracticeOptions().catch(console.error);
}

export { seedPracticeOptions };