#!/usr/bin/env node

import { config } from 'dotenv';
import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';

// Load environment variables
config({ path: '.env.local' });

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function checkDevSettingsSchema() {
  try {
    console.log('🔍 Checking dev settings table schema...\n');
    
    const command = new DescribeTableCommand({
      TableName: 'PracticeTools-dev-Settings'
    });
    
    const result = await dynamoClient.send(command);
    
    console.log('📊 Table Schema:');
    console.log('Key Schema:', JSON.stringify(result.Table.KeySchema, null, 2));
    console.log('Attribute Definitions:', JSON.stringify(result.Table.AttributeDefinitions, null, 2));
    
  } catch (error) {
    console.error('❌ Error checking dev settings schema:', error.message);
  }
}

checkDevSettingsSchema();