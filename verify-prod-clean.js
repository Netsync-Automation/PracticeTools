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

async function verifyProdClean() {
  try {
    console.log('🔍 Verifying production releases table...\n');
    
    const command = new ScanCommand({
      TableName: 'PracticeTools-prod-Releases'
    });
    
    const result = await dynamoClient.send(command);
    const releases = (result.Items || []).map(item => ({
      version: item.version?.S || '',
      date: item.date?.S || '',
      type: item.type?.S || ''
    }));
    
    console.log(`📊 Found ${releases.length} releases in production database:\n`);
    
    releases.forEach(release => {
      const isDev = release.version.includes('-dev.') || release.version.includes('dev');
      const icon = isDev ? '❌' : '✅';
      console.log(`${icon} ${release.version} - ${release.date} (${release.type})`);
    });
    
    const devVersions = releases.filter(r => r.version.includes('-dev.') || r.version.includes('dev'));
    const prodVersions = releases.filter(r => !r.version.includes('-dev.') && !r.version.includes('dev'));
    
    console.log(`\n📈 Summary:`);
    console.log(`   Production versions: ${prodVersions.length}`);
    console.log(`   Dev versions: ${devVersions.length}`);
    
    if (devVersions.length === 0) {
      console.log('\n🎉 SUCCESS: Production database is clean - only production versions remain!');
    } else {
      console.log('\n⚠️  WARNING: Dev versions still exist in production database');
    }
    
  } catch (error) {
    console.error('❌ Error verifying production releases:', error.message);
  }
}

verifyProdClean();