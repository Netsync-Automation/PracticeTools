#!/usr/bin/env node

import { config } from 'dotenv';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';

// Load environment variables
config({ path: '.env.local' });

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function checkProdSettings() {
  try {
    console.log('🔍 Checking current_version in production settings table...\n');
    
    const command = new GetItemCommand({
      TableName: 'PracticeTools-prod-Settings',
      Key: {
        setting_key: { S: 'current_version' }
      }
    });
    
    const result = await dynamoClient.send(command);
    
    if (!result.Item) {
      console.log('❌ current_version key not found in production settings table');
      return;
    }
    
    const currentVersion = result.Item.setting_value?.S || '';
    const updatedAt = result.Item.updated_at?.S || '';
    
    console.log('✅ Found current_version in production settings:');
    console.log(`📦 Current Version: ${currentVersion}`);
    console.log(`⏰ Updated At: ${updatedAt}`);
    
    if (currentVersion === 'v1.0.0') {
      console.log('\n🎉 SUCCESS: Production settings shows correct version v1.0.0');
    } else {
      console.log(`\n⚠️  WARNING: Production settings shows ${currentVersion}, expected v1.0.0`);
    }
    
  } catch (error) {
    console.error('❌ Error checking production settings:', error.message);
  }
}

checkProdSettings();