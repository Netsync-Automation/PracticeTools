#!/usr/bin/env node

import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const client = new DynamoDBClient({ 
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function checkProdAssignment() {
  try {
    console.log('🔍 Checking production assignment for project #200003222...\n');
    
    const command = new ScanCommand({
      TableName: 'PracticeTools-prod-resource-assignments',
      FilterExpression: 'projectNumber = :projectNumber',
      ExpressionAttributeValues: {
        ':projectNumber': { S: '200003222' }
      }
    });
    
    const result = await client.send(command);
    
    if (!result.Items || result.Items.length === 0) {
      console.log('❌ No assignment found for project #200003222');
      return;
    }
    
    const assignment = result.Items[0];
    
    console.log('📋 Assignment Found:');
    console.log('==================');
    console.log(`ID: ${assignment.id?.S || 'N/A'}`);
    console.log(`Project #: ${assignment.projectNumber?.S || 'N/A'}`);
    console.log(`Customer: ${assignment.customerName?.S || 'N/A'}`);
    console.log(`Status: ${assignment.status?.S || 'N/A'}`);
    console.log();
    
    console.log('👥 Name Fields:');
    console.log('===============');
    console.log(`AM: ${assignment.am?.S || 'N/A'}`);
    console.log(`PM: ${assignment.pm?.S || 'N/A'}`);
    console.log(`Resource Assigned: ${assignment.resourceAssigned?.S || 'N/A'}`);
    console.log();
    
    console.log('📧 Email Fields (DSR):');
    console.log('======================');
    console.log(`AM Email: ${assignment.am_email?.S || 'MISSING'}`);
    console.log(`PM Email: ${assignment.pm_email?.S || 'MISSING'}`);
    console.log(`Resource Email: ${assignment.resource_assigned_email?.S || 'MISSING'}`);
    console.log();
    
    console.log('🔔 Notification Users:');
    console.log('======================');
    const notificationUsers = assignment.resource_assignment_notification_users?.S || '[]';
    console.log(`Raw: ${notificationUsers}`);
    
    try {
      const parsed = JSON.parse(notificationUsers);
      console.log(`Parsed (${parsed.length} users):`);
      parsed.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.name || 'N/A'} <${user.email || 'N/A'}>`);
      });
    } catch (e) {
      console.log('❌ Failed to parse notification users JSON');
    }
    
    console.log();
    console.log('📅 Timestamps:');
    console.log('==============');
    console.log(`Created: ${assignment.created_at?.S || 'N/A'}`);
    console.log(`Updated: ${assignment.updated_at?.S || 'N/A'}`);
    
  } catch (error) {
    console.error('❌ Error checking production assignment:', error.message);
  }
}

checkProdAssignment();