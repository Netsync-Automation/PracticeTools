#!/usr/bin/env node

import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { config } from 'dotenv';

config({ path: '.env.local' });

const client = new DynamoDBClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function checkUser() {
  console.log('🔍 Checking user: mbgriffin@netsync.com\n');
  
  try {
    const command = new GetItemCommand({
      TableName: 'PracticeTools-prod-Users',
      Key: { email: { S: 'mbgriffin@netsync.com' } }
    });
    
    const result = await client.send(command);
    
    if (result.Item) {
      console.log('📋 User found in database:');
      console.log('Email:', result.Item.email?.S);
      console.log('Name:', result.Item.name?.S);
      console.log('Role:', result.Item.role?.S);
      console.log('isAdmin (BOOL):', result.Item.isAdmin?.BOOL);
      console.log('is_admin (BOOL):', result.Item.is_admin?.BOOL);
      console.log('Auth Method:', result.Item.auth_method?.S);
      console.log('\nRaw item:', JSON.stringify(result.Item, null, 2));
    } else {
      console.log('❌ User not found in production database');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkUser().catch(console.error);