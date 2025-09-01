#!/usr/bin/env node

/**
 * Reset Database Script
 * 
 * This script completely resets the PracticeTools database by:
 * 1. Deleting all issues from PracticeTools-Issues table
 * 2. Resetting the issue counter to 0 (next issue will be #1)
 * 3. Cleaning up all orphaned records from related tables
 * 
 * WARNING: This is destructive and cannot be undone!
 */

import { config } from 'dotenv';
import { DynamoDBClient, ScanCommand, DeleteItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';

// Load environment variables
config({ path: '.env.local' });

const client = new DynamoDBClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function deleteAllIssues() {
  console.log('🗑️ Deleting all issues...');
  
  const result = await client.send(new ScanCommand({
    TableName: 'PracticeTools-Issues'
  }));
  
  console.log(`Found ${result.Items.length} issues to delete`);
  
  for (const item of result.Items) {
    await client.send(new DeleteItemCommand({
      TableName: 'PracticeTools-Issues',
      Key: { id: item.id }
    }));
    console.log(`Deleted issue: ${item.issue_number?.N || 'unknown'}`);
  }
  
  console.log('✅ All issues deleted');
}

async function resetIssueCounter() {
  console.log('🔄 Resetting issue counter to 0...');
  
  await client.send(new PutItemCommand({
    TableName: 'PracticeTools-Settings',
    Item: {
      setting_key: { S: 'issue_counter' },
      setting_value: { S: '0' },
      updated_at: { S: new Date().toISOString() }
    }
  }));
  
  console.log('✅ Issue counter reset to 0');
}

async function cleanTable(tableName, keyFields) {
  try {
    console.log(`🧹 Cleaning ${tableName}...`);
    
    const result = await client.send(new ScanCommand({
      TableName: tableName
    }));
    
    console.log(`Found ${result.Items.length} records in ${tableName}`);
    
    for (const item of result.Items) {
      const key = {};
      keyFields.forEach(field => {
        key[field] = item[field];
      });
      
      await client.send(new DeleteItemCommand({
        TableName: tableName,
        Key: key
      }));
    }
    
    console.log(`✅ Cleaned ${tableName}`);
  } catch (error) {
    console.log(`⚠️ ${tableName} not found or empty:`, error.message);
  }
}

async function cleanOrphanedRecords() {
  console.log('🧹 Cleaning orphaned records...');
  
  await Promise.all([
    cleanTable('PracticeTools-Upvotes', ['issue_id', 'user_email']),
    cleanTable('PracticeTools-Followers', ['issue_id', 'user_email']),
    cleanTable('PracticeTools-StatusLog', ['id'])
  ]);
  
  console.log('✅ All orphaned records cleaned');
}

async function resetDatabase() {
  console.log('🚨 === DATABASE RESET INITIATED ===');
  console.log('⚠️ WARNING: This will delete ALL issues and related data!');
  console.log('📅 Start time:', new Date().toISOString());
  
  try {
    // Step 1: Delete all issues
    await deleteAllIssues();
    
    // Step 2: Reset issue counter
    await resetIssueCounter();
    
    // Step 3: Clean orphaned records
    await cleanOrphanedRecords();
    
    console.log('🎯 === DATABASE RESET COMPLETED ===');
    console.log('📅 End time:', new Date().toISOString());
    console.log('✅ Database is now clean - next issue will be #1');
    
  } catch (error) {
    console.error('💥 Database reset failed:', error);
    console.error('📋 Error details:', error.stack);
    process.exit(1);
  }
}

// Run the reset
resetDatabase();