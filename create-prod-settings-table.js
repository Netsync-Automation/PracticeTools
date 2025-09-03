#!/usr/bin/env node

import { config } from 'dotenv';
import { DynamoDBClient, CreateTableCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';

// Load environment variables
config({ path: '.env.local' });

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function createProdSettingsTable() {
  try {
    console.log('🔧 Creating production settings table...\n');
    
    // Create the table
    const createCommand = new CreateTableCommand({
      TableName: 'PracticeTools-prod-Settings',
      KeySchema: [{
        AttributeName: 'setting_key',
        KeyType: 'HASH'
      }],
      AttributeDefinitions: [{
        AttributeName: 'setting_key',
        AttributeType: 'S'
      }],
      BillingMode: 'PAY_PER_REQUEST'
    });
    
    await dynamoClient.send(createCommand);
    console.log('✅ Production settings table created');
    
    // Wait for table to be active
    console.log('⏳ Waiting for table to become active...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Add the current_version setting
    console.log('📦 Adding current_version setting...');
    const putCommand = new PutItemCommand({
      TableName: 'PracticeTools-prod-Settings',
      Item: {
        key: { S: 'current_version' },
        setting_value: { S: 'v1.0.0' },
        updated_at: { S: new Date().toISOString() }
      }
    });
    
    await dynamoClient.send(putCommand);
    
    console.log('✅ Successfully created production settings table and added current_version');
    console.log('📦 Key: current_version');
    console.log('🎯 Value: v1.0.0');
    
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log('⚠️  Table already exists, just adding the setting...');
      
      const putCommand = new PutItemCommand({
        TableName: 'PracticeTools-prod-Settings',
        Item: {
          setting_key: { S: 'current_version' },
          setting_value: { S: 'v1.0.0' },
          updated_at: { S: new Date().toISOString() }
        }
      });
      
      await dynamoClient.send(putCommand);
      console.log('✅ Added current_version setting to existing table');
    } else {
      console.error('❌ Error creating production settings table:', error.message);
    }
  }
}

createProdSettingsTable();