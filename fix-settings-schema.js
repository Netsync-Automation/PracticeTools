#!/usr/bin/env node

import { config } from 'dotenv';
import { DynamoDBClient, DeleteTableCommand, CreateTableCommand, ScanCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';

// Load environment variables
config({ path: '.env.local' });

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function fixSettingsSchema() {
  try {
    console.log('🔧 Fixing PracticeTools-prod-Settings schema mismatch...\n');
    
    // 1. Backup existing data
    console.log('💾 Backing up existing production settings data...');
    let backupData = [];
    try {
      const scanCommand = new ScanCommand({ TableName: 'PracticeTools-prod-Settings' });
      const scanResult = await dynamoClient.send(scanCommand);
      backupData = scanResult.Items || [];
      console.log(`   📊 Backed up ${backupData.length} items`);
      
      // Show what we're backing up
      backupData.forEach((item, index) => {
        const key = item.key?.S || 'unknown';
        const value = item.value?.S || item.setting_value?.S || 'unknown';
        console.log(`   ${index + 1}. ${key} = ${value}`);
      });
    } catch (error) {
      console.log(`   ⚠️  Could not backup data: ${error.message}`);
    }
    
    // 2. Delete the mismatched table
    console.log('\n🗑️  Deleting mismatched production settings table...');
    await dynamoClient.send(new DeleteTableCommand({ TableName: 'PracticeTools-prod-Settings' }));
    console.log('   ✅ Table deleted');
    
    // 3. Wait for deletion
    console.log('⏳ Waiting for table deletion to complete...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // 4. Create new table with correct dev schema
    console.log('📊 Creating new table with correct dev schema...');
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
    console.log('   ✅ Table created with setting_key as primary key');
    
    // 5. Wait for table to become active
    console.log('⏳ Waiting for table to become active...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // 6. Restore data with schema conversion
    if (backupData.length > 0) {
      console.log(`\n🔄 Restoring ${backupData.length} items with new schema...`);
      
      for (const item of backupData) {
        try {
          // Convert old schema (key/value) to new schema (setting_key/setting_value)
          const convertedItem = {
            setting_key: { S: item.key?.S || 'unknown' },
            setting_value: { S: item.value?.S || item.setting_value?.S || '' },
            updated_at: { S: item.updated_at?.S || new Date().toISOString() }
          };
          
          const putCommand = new PutItemCommand({
            TableName: 'PracticeTools-prod-Settings',
            Item: convertedItem
          });
          
          await dynamoClient.send(putCommand);
          console.log(`   ✅ Restored: ${convertedItem.setting_key.S} = ${convertedItem.setting_value.S}`);
          
        } catch (restoreError) {
          console.log(`   ❌ Failed to restore item: ${restoreError.message}`);
        }
      }
    }
    
    console.log('\n🎉 Schema fix completed successfully!');
    console.log('📋 Summary:');
    console.log('   - Old schema: key (HASH)');
    console.log('   - New schema: setting_key (HASH)');
    console.log('   - Data converted: key → setting_key, value → setting_value');
    console.log('   - Production settings table now matches dev schema');
    
  } catch (error) {
    console.error('❌ Error fixing settings schema:', error.message);
  }
}

fixSettingsSchema();