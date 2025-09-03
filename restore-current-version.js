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

async function restoreCurrentVersion() {
  try {
    console.log('🔄 Restoring current_version to fixed production settings table...\n');
    
    const command = new PutItemCommand({
      TableName: 'PracticeTools-prod-Settings',
      Item: {
        setting_key: { S: 'current_version' },
        setting_value: { S: 'v1.0.0' },
        updated_at: { S: new Date().toISOString() }
      }
    });
    
    await dynamoClient.send(command);
    
    console.log('✅ Successfully restored current_version setting');
    console.log('📦 setting_key: current_version');
    console.log('🎯 setting_value: v1.0.0');
    console.log('⏰ updated_at: ' + new Date().toISOString());
    
  } catch (error) {
    console.error('❌ Error restoring current_version:', error.message);
  }
}

restoreCurrentVersion();