#!/usr/bin/env node

import { config } from 'dotenv';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

config({ path: '.env.local' });

const client = new DynamoDBClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function checkUserCount() {
  console.log('🔍 Checking DynamoDB Users table...\n');
  
  try {
    const result = await client.send(new ScanCommand({
      TableName: 'PracticeTools-Users',
      Select: 'COUNT'
    }));
    
    console.log(`👥 Total users in database: ${result.Count}`);
    
    if (result.Count > 0) {
      // Get actual user data to show details
      const usersResult = await client.send(new ScanCommand({
        TableName: 'PracticeTools-Users'
      }));
      
      console.log('\n📋 User Details:');
      usersResult.Items.forEach((user, index) => {
        console.log(`${index + 1}. Email: ${user.email?.S || 'N/A'}`);
        console.log(`   Name: ${user.name?.S || 'N/A'}`);
        console.log(`   Role: ${user.role?.S || 'N/A'}`);
        console.log(`   Auth Method: ${user.auth_method?.S || 'N/A'}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking users:', error.message);
  }
}

checkUserCount();