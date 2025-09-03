#!/usr/bin/env node

import { config } from 'dotenv';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';

// Load environment variables
config({ path: '.env.local' });

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function checkV1Notes() {
  try {
    console.log('🔍 Checking v1.0.0 release notes in production database...\n');
    
    const command = new GetItemCommand({
      TableName: 'PracticeTools-prod-Releases',
      Key: {
        version: { S: 'v1.0.0' }
      }
    });
    
    const result = await dynamoClient.send(command);
    
    if (!result.Item) {
      console.log('❌ v1.0.0 not found in production database');
      return;
    }
    
    const release = {
      version: result.Item.version?.S || '',
      date: result.Item.date?.S || '',
      type: result.Item.type?.S || '',
      notes: result.Item.notes?.S || '',
      features: JSON.parse(result.Item.features?.S || '[]'),
      breaking: JSON.parse(result.Item.breaking?.S || '[]'),
      bugFixes: JSON.parse(result.Item.bugFixes?.S || '[]')
    };
    
    console.log('✅ Found v1.0.0 in production database:');
    console.log(`📦 Version: ${release.version}`);
    console.log(`📅 Date: ${release.date}`);
    console.log(`🏷️  Type: ${release.type}`);
    console.log(`📝 Notes length: ${release.notes.length} characters`);
    console.log(`🔧 Features: ${release.features.length} items`);
    console.log(`🚨 Breaking: ${release.breaking.length} items`);
    console.log(`🐛 Bug fixes: ${release.bugFixes.length} items`);
    
    console.log('\n📝 RELEASE NOTES PREVIEW:');
    console.log('=' .repeat(50));
    console.log(release.notes.substring(0, 500) + (release.notes.length > 500 ? '...' : ''));
    console.log('=' .repeat(50));
    
    if (release.notes.length > 0) {
      console.log('\n✅ Release notes are present and restored');
    } else {
      console.log('\n❌ Release notes are missing or empty');
    }
    
  } catch (error) {
    console.error('❌ Error checking v1.0.0 release notes:', error.message);
  }
}

checkV1Notes();