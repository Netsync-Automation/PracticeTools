#!/usr/bin/env node

import { config } from 'dotenv';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

// Load environment variables
config({ path: '.env.local' });

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function fixProdVersionSetting() {
  try {
    console.log('🔧 Adding current_version setting to production settings table...\n');
    
    const command = new PutItemCommand({
      TableName: 'PracticeTools-prod-Settings',
      Item: {
        setting_key: { S: 'current_version' },
        setting_value: { S: 'v1.0.0' },
        updated_at: { S: new Date().toISOString() }
      }
    });
    
    await dynamoClient.send(command);
    
    console.log('✅ Successfully added current_version setting to production');
    console.log('📦 Key: current_version');
    console.log('🎯 Value: v1.0.0');
    console.log('⏰ Updated: ' + new Date().toISOString());
    
  } catch (error) {
    console.error('❌ Error adding version setting:', error.message);
  }
}

fixProdVersionSetting();