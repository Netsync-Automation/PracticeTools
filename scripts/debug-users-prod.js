#!/usr/bin/env node

// Debug script to test user fetching in production environment
import { db, getEnvironment, getTableName } from '../lib/dynamodb.js';

async function debugUsersFetch() {
  console.log('=== DEBUG USERS FETCH ===');
  console.log('Environment:', process.env.ENVIRONMENT);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('Detected environment:', getEnvironment());
  console.log('Users table name:', getTableName('Users'));
  
  try {
    console.log('\nFetching users...');
    const users = await db.getAllUsers();
    console.log('Users found:', users.length);
    
    if (users.length > 0) {
      console.log('\nSample users:');
      users.slice(0, 5).forEach(user => {
        console.log(`- ${user.name} (${user.email}) - Role: ${user.role}`);
      });
    } else {
      console.log('No users found in the database!');
      
      // Check if we can access the table at all
      console.log('\nTrying to check table existence...');
      try {
        const { DynamoDBClient, DescribeTableCommand } = await import('@aws-sdk/client-dynamodb');
        const client = new DynamoDBClient({
          region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
          }
        });
        
        const tableName = getTableName('Users');
        const describeCommand = new DescribeTableCommand({ TableName: tableName });
        const tableInfo = await client.send(describeCommand);
        console.log(`Table ${tableName} exists with status:`, tableInfo.Table.TableStatus);
        console.log('Item count:', tableInfo.Table.ItemCount);
      } catch (tableError) {
        console.error('Table access error:', tableError.message);
      }
    }
  } catch (error) {
    console.error('Error fetching users:', error);
  }
}

debugUsersFetch().catch(console.error);