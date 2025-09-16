import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const client = new DynamoDBClient({
  region: process.env.AWS_DEFAULT_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const docClient = DynamoDBDocumentClient.from(client);

async function debugUser() {
  try {
    console.log('🔍 Scanning all users to find John Birdsong...');
    
    // Scan all users to find any variations
    const scanCommand = new ScanCommand({
      TableName: 'PracticeTools-dev-Users'
    });
    
    const scanResult = await docClient.send(scanCommand);
    
    console.log(`Found ${scanResult.Items.length} total users`);
    
    // Look for John Birdsong variations
    const johnUsers = scanResult.Items.filter(user => 
      user.email?.toLowerCase().includes('birdsong') || 
      user.name?.toLowerCase().includes('birdsong') ||
      user.email?.toLowerCase().includes('jbirdsong')
    );
    
    console.log('\n🔍 John Birdsong variations found:', johnUsers.length);
    johnUsers.forEach(user => {
      console.log('- Email:', user.email);
      console.log('- Name:', user.name);
      console.log('- Practices:', user.practices);
      console.log('- Auth Method:', user.auth_method);
      console.log('- Created From:', user.created_from);
      console.log('---');
    });
    
    // Also check exact match with correct case
    const getUserCommand = new GetCommand({
      TableName: 'PracticeTools-dev-Users',
      Key: {
        email: 'JBirdsong@netsync.com'
      }
    });
    
    const userResult = await docClient.send(getUserCommand);
    
    if (userResult.Item) {
      console.log('\n✅ Found JBirdsong@netsync.com user record:');
      console.log(JSON.stringify(userResult.Item, null, 2));
      
      // Check practices field specifically
      console.log('\n🔍 Practices field analysis:');
      console.log('- Type:', typeof userResult.Item.practices);
      console.log('- Value:', userResult.Item.practices);
      console.log('- Is Array:', Array.isArray(userResult.Item.practices));
      console.log('- Length:', userResult.Item.practices?.length || 'N/A');
      
      if (Array.isArray(userResult.Item.practices)) {
        console.log('- Practices:', userResult.Item.practices.map(p => `"${p}"`).join(', '));
      }
    } else {
      console.log('\n❌ JBirdsong@netsync.com user record not found with exact case');
    }
    
    // Also check mike@irgriffin.com for comparison
    console.log('\n🔍 Checking mike@irgriffin.com for comparison...');
    
    const getMikeCommand = new GetCommand({
      TableName: 'PracticeTools-dev-Users',
      Key: {
        email: 'mike@irgriffin.com'
      }
    });
    
    const mikeResult = await docClient.send(getMikeCommand);
    
    if (mikeResult.Item) {
      console.log('✅ Found mike@irgriffin.com user record:');
      console.log('- Practices:', mikeResult.Item.practices);
      console.log('- Type:', typeof mikeResult.Item.practices);
      console.log('- Is Array:', Array.isArray(mikeResult.Item.practices));
      console.log('- Length:', mikeResult.Item.practices?.length || 'N/A');
    } else {
      console.log('❌ mike@irgriffin.com user record not found');
    }
    
  } catch (error) {
    console.error('❌ Error querying database:', error);
  }
}

debugUser();