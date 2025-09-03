#!/usr/bin/env node

import { DynamoDBClient, CreateTableCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const ENV = (process.env.ENVIRONMENT || 'dev').trim();
console.log(`Creating tables for ${ENV} environment...`);

const client = new DynamoDBClient({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1'
});

const tables = [
  {
    name: `PracticeTools-${ENV}-Users`,
    keySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
    attributeDefinitions: [{ AttributeName: 'email', AttributeType: 'S' }]
  },
  {
    name: `PracticeTools-${ENV}-Issues`,
    keySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    attributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }]
  },
  {
    name: `PracticeTools-${ENV}-Settings`,
    keySchema: [{ AttributeName: 'setting_key', KeyType: 'HASH' }],
    attributeDefinitions: [{ AttributeName: 'setting_key', AttributeType: 'S' }]
  },
  {
    name: `PracticeTools-${ENV}-Upvotes`,
    keySchema: [
      { AttributeName: 'issue_id', KeyType: 'HASH' },
      { AttributeName: 'user_email', KeyType: 'RANGE' }
    ],
    attributeDefinitions: [
      { AttributeName: 'issue_id', AttributeType: 'S' },
      { AttributeName: 'user_email', AttributeType: 'S' }
    ]
  },
  {
    name: `PracticeTools-${ENV}-Comments`,
    keySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    attributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }]
  },
  {
    name: `PracticeTools-${ENV}-Followers`,
    keySchema: [
      { AttributeName: 'issue_id', KeyType: 'HASH' },
      { AttributeName: 'user_email', KeyType: 'RANGE' }
    ],
    attributeDefinitions: [
      { AttributeName: 'issue_id', AttributeType: 'S' },
      { AttributeName: 'user_email', AttributeType: 'S' }
    ]
  },
  {
    name: `PracticeTools-${ENV}-Releases`,
    keySchema: [{ AttributeName: 'version', KeyType: 'HASH' }],
    attributeDefinitions: [{ AttributeName: 'version', AttributeType: 'S' }]
  },
  {
    name: `PracticeTools-${ENV}-Features`,
    keySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    attributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }]
  },
  {
    name: `PracticeTools-${ENV}-StatusLog`,
    keySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    attributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }]
  }
];

async function createTable(tableConfig) {
  const command = new CreateTableCommand({
    TableName: tableConfig.name,
    KeySchema: tableConfig.keySchema,
    AttributeDefinitions: tableConfig.attributeDefinitions,
    BillingMode: 'PAY_PER_REQUEST'
  });

  try {
    await client.send(command);
    console.log(`✅ Created table: ${tableConfig.name}`);
    return true;
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log(`⚠️  Table already exists: ${tableConfig.name}`);
      return true;
    }
    console.error(`❌ Failed to create table ${tableConfig.name}:`, error.message);
    return false;
  }
}

async function createDefaultAdmin() {
  try {
    const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@localhost';
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'P!7xZ@r4eL9w#Vu1Tq&';
    const adminName = process.env.DEFAULT_ADMIN_NAME || 'Administrator';

    console.log(`Creating default admin user: ${adminEmail}`);
    
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    const command = new PutItemCommand({
      TableName: `PracticeTools-${ENV}-Users`,
      Item: {
        email: { S: adminEmail },
        name: { S: adminName },
        role: { S: 'admin' },
        auth_method: { S: 'local' },
        created_from: { S: 'system' },
        password: { S: hashedPassword },
        created_at: { S: new Date().toISOString() },
        last_login: { S: new Date().toISOString() }
      }
    });
    
    await client.send(command);
    console.log('✅ Default admin user created successfully');
  } catch (error) {
    console.error('❌ Error creating default admin:', error.message);
  }
}

async function main() {
  console.log(`🚀 Creating ${tables.length} DynamoDB tables for ${ENV} environment...\n`);

  let successCount = 0;
  for (const table of tables) {
    const success = await createTable(table);
    if (success) successCount++;
    
    // Wait a bit between table creations
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n📊 Created ${successCount}/${tables.length} tables successfully`);

  if (successCount > 0) {
    console.log('\n⏳ Waiting for tables to become active...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log('\n👤 Creating default admin user...');
    await createDefaultAdmin();
  }

  console.log('\n🎉 Dev environment setup complete!');
  console.log(`\nYou can now login with:`);
  console.log(`Email: ${process.env.DEFAULT_ADMIN_EMAIL || 'admin@localhost'}`);
  console.log(`Password: ${process.env.DEFAULT_ADMIN_PASSWORD || 'P!7xZ@r4eL9w#Vu1Tq&'}`);
}

main().catch(console.error);