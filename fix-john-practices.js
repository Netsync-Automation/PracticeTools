import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
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

async function fixJohnPractices() {
  try {
    console.log('🔧 Fixing John Birdsong practices field...');
    
    // Get current user record
    const getUserCommand = new GetCommand({
      TableName: 'PracticeTools-dev-Users',
      Key: {
        email: 'JBirdsong@netsync.com'
      }
    });
    
    const userResult = await docClient.send(getUserCommand);
    
    if (!userResult.Item) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('📋 Current practices field:', userResult.Item.practices);
    console.log('📋 Type:', typeof userResult.Item.practices);
    
    // Parse the JSON string to get the actual array
    let practicesArray;
    if (typeof userResult.Item.practices === 'string') {
      try {
        practicesArray = JSON.parse(userResult.Item.practices);
        console.log('✅ Parsed practices:', practicesArray);
      } catch (parseError) {
        console.log('❌ Failed to parse practices JSON:', parseError.message);
        return;
      }
    } else {
      practicesArray = userResult.Item.practices;
    }
    
    // Update the user record with the correct practices array
    const updateCommand = new UpdateCommand({
      TableName: 'PracticeTools-dev-Users',
      Key: {
        email: 'JBirdsong@netsync.com'
      },
      UpdateExpression: 'SET practices = :practices',
      ExpressionAttributeValues: {
        ':practices': practicesArray // Store as actual array, not JSON string
      }
    });
    
    await docClient.send(updateCommand);
    console.log('✅ Updated John Birdsong practices field successfully');
    
    // Verify the fix
    const verifyResult = await docClient.send(getUserCommand);
    console.log('🔍 Verification - practices field:', verifyResult.Item.practices);
    console.log('🔍 Verification - type:', typeof verifyResult.Item.practices);
    console.log('🔍 Verification - is array:', Array.isArray(verifyResult.Item.practices));
    
  } catch (error) {
    console.error('❌ Error fixing practices:', error);
  }
}

fixJohnPractices();