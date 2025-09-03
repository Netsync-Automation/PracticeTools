#!/usr/bin/env node

import { config } from 'dotenv';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

// Load environment variables
config({ path: '.env.local' });

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function scanProdSettings() {
  try {
    console.log('🔍 Scanning production settings table...\n');
    
    const command = new ScanCommand({
      TableName: 'PracticeTools-prod-Settings'
    });
    
    const result = await dynamoClient.send(command);
    
    if (!result.Items || result.Items.length === 0) {
      console.log('❌ No items found in production settings table');
      return;
    }
    
    console.log(`📊 Found ${result.Items.length} items in production settings:\n`);
    
    result.Items.forEach((item, index) => {
      console.log(`${index + 1}. Key: ${Object.keys(item).join(', ')}`);
      Object.keys(item).forEach(key => {
        const value = item[key]?.S || item[key]?.N || JSON.stringify(item[key]);
        console.log(`   ${key}: ${value}`);
      });
      console.log('');
    });
    
    // Look specifically for version-related keys
    const versionItems = result.Items.filter(item => 
      Object.keys(item).some(key => 
        item[key]?.S?.includes('version') || 
        key.toLowerCase().includes('version')
      )
    );
    
    if (versionItems.length > 0) {
      console.log('🎯 Version-related items:');
      versionItems.forEach(item => {
        Object.keys(item).forEach(key => {
          const value = item[key]?.S || item[key]?.N || JSON.stringify(item[key]);
          console.log(`   ${key}: ${value}`);
        });
      });
    }
    
  } catch (error) {
    console.error('❌ Error scanning production settings:', error.message);
  }
}

scanProdSettings();