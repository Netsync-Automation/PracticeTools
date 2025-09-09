import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { readFileSync } from 'fs';

// Load credentials from .env.local
let credentials;
try {
  const envContent = readFileSync('.env.local', 'utf8');
  const envVars = {};
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      envVars[key] = value;
    }
  });
  
  credentials = {
    accessKeyId: envVars.AWS_ACCESS_KEY_ID,
    secretAccessKey: envVars.AWS_SECRET_ACCESS_KEY
  };
} catch (error) {
  console.error('Error loading .env.local:', error.message);
  process.exit(1);
}

const client = new DynamoDBClient({
  region: 'us-east-1',
  credentials
});

async function checkUserRecord() {
  try {
    console.log('=== CHECKING USER RECORD FOR mbgriffin@netsync.com ===');
    
    const command = new GetItemCommand({
      TableName: 'PracticeTools-prod-Users',
      Key: {
        email: { S: 'mbgriffin@netsync.com' }
      }
    });
    
    const result = await client.send(command);
    
    if (result.Item) {
      console.log('\n=== USER FOUND IN DATABASE ===');
      console.log('Email:', result.Item.email?.S || 'N/A');
      console.log('Name:', result.Item.name?.S || 'N/A');
      console.log('Role:', result.Item.role?.S || 'N/A');
      console.log('isAdmin:', result.Item.is_admin?.BOOL || 'N/A');
      console.log('Auth Method:', result.Item.auth_method?.S || 'N/A');
      console.log('Status:', result.Item.status?.S || 'N/A');
      console.log('\nRaw DynamoDB Item:');
      console.log(JSON.stringify(result.Item, null, 2));
    } else {
      console.log('\n❌ USER NOT FOUND IN DATABASE');
    }
    
  } catch (error) {
    console.error('Error checking user record:', error.message);
    if (error.name === 'ResourceNotFoundException') {
      console.log('❌ Table PracticeTools-prod-Users does not exist');
    }
  }
}

checkUserRecord();