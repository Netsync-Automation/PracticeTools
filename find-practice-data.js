import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const db = DynamoDBDocumentClient.from(client);

async function findPracticeData() {
  try {
    // Check all practice-related tables
    const tables = [
      'PracticeTools-dev-Settings',
      'PracticeTools-dev-PracticeBoardLabels',
      'PracticeTools-dev-PracticeOptions'
    ];
    
    for (const tableName of tables) {
      console.log(`\n=== Checking ${tableName} ===`);
      try {
        const result = await db.send(new ScanCommand({ TableName: tableName }));
        console.log(`Found ${result.Items?.length || 0} items`);
        
        for (const item of result.Items || []) {
          if (JSON.stringify(item).toLowerCase().includes('fort worth') || 
              JSON.stringify(item).toLowerCase().includes('singlewire') ||
              JSON.stringify(item).toLowerCase().includes('audio') ||
              JSON.stringify(item).toLowerCase().includes('visual')) {
            console.log('Found relevant item:', JSON.stringify(item, null, 2));
          }
        }
      } catch (error) {
        console.log(`Error scanning ${tableName}:`, error.message);
      }
    }
    
    // Also check if there's a direct followers record
    console.log('\n=== Checking Followers table ===');
    try {
      const followers = await db.send(new ScanCommand({
        TableName: 'PracticeTools-dev-Followers'
      }));
      
      console.log(`Found ${followers.Items?.length || 0} followers`);
      
      for (const follower of followers.Items || []) {
        if (follower.userEmail === 'mbgriffin@netsync.com') {
          console.log('Found mbgriffin follow record:', JSON.stringify(follower, null, 2));
        }
      }
    } catch (error) {
      console.log('Error checking followers:', error.message);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

findPracticeData();