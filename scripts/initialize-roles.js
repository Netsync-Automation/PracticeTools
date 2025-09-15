import { DynamoDBClient, PutItemCommand, ScanCommand, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

// Load .env.local
dotenv.config({ path: '.env.local' });

const client = new DynamoDBClient({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const roles = [
  { value: 'account_manager', label: 'Account Manager' },
  { value: 'admin', label: 'Admin' },
  { value: 'executive', label: 'Executive' },
  { value: 'isr', label: 'ISR' },
  { value: 'netsync_employee', label: 'Netsync Employee' },
  { value: 'practice_manager', label: 'Practice Manager' },
  { value: 'practice_member', label: 'Practice Member' },
  { value: 'practice_principal', label: 'Practice Principal' }
];

async function initializeRoles(environment) {
  const tableName = `PracticeTools-${environment}-UserRoles`;
  console.log(`Initializing roles for ${tableName}...`);
  
  try {
    // Check if table exists and get existing roles
    const scanCommand = new ScanCommand({ TableName: tableName });
    const result = await client.send(scanCommand);
    const existingRoles = (result.Items || []).map(item => item.value?.S);
    
    // Add missing roles
    for (const role of roles) {
      if (!existingRoles.includes(role.value)) {
        console.log(`Adding role: ${role.label} to ${environment}`);
        const putCommand = new PutItemCommand({
          TableName: tableName,
          Item: {
            id: { S: uuidv4() },
            value: { S: role.value },
            label: { S: role.label },
            created_at: { S: new Date().toISOString() },
            environment: { S: environment }
          }
        });
        await client.send(putCommand);
      } else {
        console.log(`Role ${role.label} already exists in ${environment}`);
      }
    }
    
    console.log(`✅ Roles initialized for ${environment}`);
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      console.log(`Table ${tableName} not found, creating...`);
      await createTable(tableName, environment);
    } else {
      console.error(`Error initializing roles for ${environment}:`, error);
    }
  }
}

async function createTable(tableName, environment) {
  try {
    const createCommand = new CreateTableCommand({
      TableName: tableName,
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
      BillingMode: 'PAY_PER_REQUEST'
    });
    
    await client.send(createCommand);
    console.log(`Table ${tableName} created, waiting for it to be active...`);
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Initialize roles after table creation
    await initializeRoles(environment);
  } catch (error) {
    console.error(`Error creating table ${tableName}:`, error);
  }
}

async function main() {
  console.log('🚀 Initializing user roles in both dev and prod environments...');
  
  await initializeRoles('dev');
  await initializeRoles('prod');
  
  console.log('✅ Role initialization complete!');
}

main().catch(console.error);