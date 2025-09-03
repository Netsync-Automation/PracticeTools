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

async function checkProdSettingsSchema() {
  try {
    console.log('🔍 Checking production settings table schema...\n');
    
    const command = new DescribeTableCommand({
      TableName: 'PracticeTools-prod-Settings'
    });
    
    const result = await dynamoClient.send(command);
    
    console.log('📊 Production Settings Table Schema:');
    console.log('Key Schema:', JSON.stringify(result.Table.KeySchema, null, 2));
    console.log('Attribute Definitions:', JSON.stringify(result.Table.AttributeDefinitions, null, 2));
    console.log('Table Status:', result.Table.TableStatus);
    
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      console.log('❌ Production settings table does not exist');
    } else {
      console.error('❌ Error checking production settings schema:', error.message);
    }
  }
}

checkProdSettingsSchema();