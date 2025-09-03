#!/usr/bin/env node

import { DynamoDBClient, ScanCommand, DeleteItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { readFileSync } from 'fs';

// Load AWS credentials from .env.local
const envContent = readFileSync('.env.local', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key] = value;
  }
});

const client = new DynamoDBClient({
  region: envVars.AWS_DEFAULT_REGION || 'us-east-1',
  credentials: {
    accessKeyId: envVars.AWS_ACCESS_KEY_ID,
    secretAccessKey: envVars.AWS_SECRET_ACCESS_KEY
  },
  maxAttempts: 3,
  retryMode: 'adaptive',
});

const PROD_RELEASES_TABLE = 'PracticeTools-Releases';

console.log('🔑 Using AWS credentials from .env.local');
console.log(`📍 Region: ${envVars.AWS_DEFAULT_REGION}`);
console.log(`🔐 Access Key: ${envVars.AWS_ACCESS_KEY_ID?.substring(0, 8)}...`);

async function fixProdVersionTable() {
  console.log('🔧 PRODUCTION VERSION TABLE FIX');
  console.log('⚠️  This will revert production version table to v4.0.0');
  console.log(`📊 Target table: ${PROD_RELEASES_TABLE}`);
  
  try {
    // 1. Scan current releases
    console.log('\n1️⃣ Scanning current releases...');
    const scanCommand = new ScanCommand({
      TableName: PROD_RELEASES_TABLE
    });
    
    let result;
    let releases = [];
    
    try {
      result = await client.send(scanCommand);
      releases = result.Items || [];
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        console.log('📋 Production releases table does not exist yet');
        console.log('✅ This means no dev versions were accidentally added to production');
        console.log('🎯 Production is clean - no action needed');
        return;
      }
      throw error;
    }
    
    if (releases.length === 0) {
      console.log('📋 Production releases table is empty');
      console.log('✅ No dev versions found in production');
      console.log('🎯 Production is clean - no action needed');
      return;
    }
    
    console.log(`📋 Found ${releases.length} releases in production table:`);
    releases.forEach(release => {
      console.log(`   - ${release.version?.S} (${release.date?.S})`);
    });
    
    // 2. Delete dev versions (5.0.0-dev.x)
    console.log('\n2️⃣ Removing dev versions from production table...');
    const devVersions = releases.filter(r => r.version?.S?.includes('-dev.'));
    
    for (const devVersion of devVersions) {
      console.log(`🗑️  Deleting ${devVersion.version?.S}...`);
      const deleteCommand = new DeleteItemCommand({
        TableName: PROD_RELEASES_TABLE,
        Key: {
          version: { S: devVersion.version.S }
        }
      });
      await client.send(deleteCommand);
      console.log(`✅ Deleted ${devVersion.version?.S}`);
    }
    
    // 3. Ensure v4.0.0 exists
    console.log('\n3️⃣ Ensuring v4.0.0 is the latest production version...');
    const hasV4 = releases.some(r => r.version?.S === '4.0.0');
    
    if (!hasV4) {
      console.log('📝 Creating v4.0.0 release record...');
      const v4Release = {
        version: { S: '4.0.0' },
        date: { S: 'August 30, 2025' },
        type: { S: 'Major Release' },
        features: { S: JSON.stringify([
          'Enhanced admin dashboard with modern design',
          'Improved user management system',
          'Better email templates and notifications',
          'Enhanced security with SSO integration'
        ]) },
        improvements: { S: JSON.stringify([
          'Better navigation and breadcrumbs',
          'Improved settings organization',
          'Enhanced password management'
        ]) },
        bugFixes: { S: JSON.stringify([
          'Fixed authentication issues',
          'Resolved email delivery problems',
          'Improved error handling'
        ]) },
        breaking: { S: JSON.stringify([]) },
        notes: { S: 'Major update with significant improvements to user experience and system reliability.' },
        helpContent: { S: '' },
        created_at: { S: new Date().toISOString() }
      };
      
      const putCommand = new PutItemCommand({
        TableName: PROD_RELEASES_TABLE,
        Item: v4Release
      });
      
      await client.send(putCommand);
      console.log('✅ Created v4.0.0 release record');
    } else {
      console.log('✅ v4.0.0 already exists in production table');
    }
    
    // 4. Verify final state
    console.log('\n4️⃣ Verifying final state...');
    const finalScan = await client.send(scanCommand);
    const finalReleases = finalScan.Items || [];
    
    console.log(`📋 Production table now contains ${finalReleases.length} releases:`);
    finalReleases
      .sort((a, b) => new Date(b.created_at?.S || 0) - new Date(a.created_at?.S || 0))
      .forEach(release => {
        console.log(`   - ${release.version?.S} (${release.date?.S})`);
      });
    
    console.log('\n✅ PRODUCTION VERSION TABLE FIXED');
    console.log('🎯 Production is now showing v4.0.0 as the latest version');
    
  } catch (error) {
    console.error('❌ Error fixing production version table:', error);
    process.exit(1);
  }
}

// Run the fix
fixProdVersionTable();