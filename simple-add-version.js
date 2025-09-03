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

async function addVersionSetting() {
  try {
    console.log('🔧 Adding current_version to production settings...\n');
    
    const command = new PutItemCommand({
      TableName: 'PracticeTools-prod-Settings',
      Item: {
        key: { S: 'current_version' },
        value: { S: 'v1.0.0' },
        updated_at: { S: new Date().toISOString() }
      }
    });
    
    await dynamoClient.send(command);
    
    console.log('✅ Successfully added current_version setting');
    console.log('📦 Key: current_version');
    console.log('🎯 Value: v1.0.0');
    
  } catch (error) {
    console.error('❌ Error adding version setting:', error.message);
    console.log('Error details:', error);
  }
}

addVersionSetting();