import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const db = DynamoDBDocumentClient.from(client);

async function createTestFollow() {
  try {
    // Create a test follow record for the practice board card
    const cardKey = 'audio-visual-board_column1_fort-worth-singlewire';
    const userEmail = 'mbgriffin@netsync.com';
    
    console.log('Creating test follow record...');
    console.log('Card key:', cardKey);
    console.log('User email:', userEmail);
    
    await db.send(new PutCommand({
      TableName: 'PracticeTools-dev-Followers',
      Item: {
        issueId: cardKey,
        userEmail: userEmail,
        status: 'following',
        createdAt: new Date().toISOString()
      }
    }));
    
    console.log('✅ Test follow record created');
    
    // Verify the record was created
    const result = await db.send(new QueryCommand({
      TableName: 'PracticeTools-dev-Followers',
      KeyConditionExpression: 'issueId = :issueId',
      ExpressionAttributeValues: {
        ':issueId': cardKey
      }
    }));
    
    console.log('Verification - followers found:', result.Items?.length || 0);
    
    const mbgriffinFollowing = result.Items?.find(f => f.userEmail === userEmail);
    
    if (mbgriffinFollowing) {
      console.log('✅ mbgriffin@netsync.com IS following the Fort Worth SInglewire card');
      console.log('Follow details:', mbgriffinFollowing);
    } else {
      console.log('❌ Follow record not found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

createTestFollow();