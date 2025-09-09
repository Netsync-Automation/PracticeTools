import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
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

async function checkProdReleases() {
  try {
    console.log('=== CHECKING PracticeTools-prod-Releases TABLE ===');
    
    const command = new ScanCommand({
      TableName: 'PracticeTools-prod-Releases'
    });
    
    const result = await client.send(command);
    
    console.log(`Total items in table: ${result.Items?.length || 0}`);
    
    if (result.Items && result.Items.length > 0) {
      console.log('\n=== RELEASES FOUND ===');
      result.Items.forEach((item, index) => {
        console.log(`${index + 1}. Version: ${item.version?.S || 'N/A'}`);
        console.log(`   Date: ${item.date?.S || 'N/A'}`);
        console.log(`   Type: ${item.type?.S || 'N/A'}`);
        console.log(`   Notes: ${item.notes?.S ? item.notes.S.substring(0, 100) + '...' : 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('\n❌ NO RELEASES FOUND IN TABLE');
    }
    
  } catch (error) {
    console.error('Error checking prod releases table:', error.message);
    if (error.name === 'ResourceNotFoundException') {
      console.log('❌ Table PracticeTools-prod-Releases does not exist');
    }
  }
}

checkProdReleases();