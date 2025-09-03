#!/usr/bin/env node

import { config } from 'dotenv';
import { DynamoDBClient, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { db } from './lib/dynamodb.js';

// Load environment variables
config({ path: '.env.local' });

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function cleanProdReleases() {
  try {
    console.log('🧹 Cleaning production releases table...\n');
    
    // Get all production releases
    const originalEnv = process.env.ENVIRONMENT;
    process.env.ENVIRONMENT = 'prod';
    
    const releases = await db.getReleases();
    
    // Restore original environment
    process.env.ENVIRONMENT = originalEnv;
    
    if (releases.length === 0) {
      console.log('❌ No releases found in production database');
      return;
    }
    
    console.log(`📊 Found ${releases.length} production releases\n`);
    
    // Find dev versions to delete
    const devVersions = releases.filter(release => 
      release.version.includes('-dev.') || release.version.includes('dev')
    );
    
    const prodVersions = releases.filter(release => 
      !release.version.includes('-dev.') && !release.version.includes('dev')
    );
    
    console.log(`🎯 Production versions to keep: ${prodVersions.length}`);
    prodVersions.forEach(release => {
      console.log(`   ✅ ${release.version} - ${release.date}`);
    });
    
    console.log(`\n🗑️  Dev versions to delete: ${devVersions.length}`);
    devVersions.forEach(release => {
      console.log(`   ❌ ${release.version} - ${release.date}`);
    });
    
    if (devVersions.length === 0) {
      console.log('\n✅ No dev versions found to delete');
      return;
    }
    
    // Confirm deletion
    console.log(`\n⚠️  About to delete ${devVersions.length} dev versions from production database`);
    console.log('This action cannot be undone!');
    
    // Delete dev versions
    let deletedCount = 0;
    for (const release of devVersions) {
      try {
        const deleteCommand = new DeleteItemCommand({
          TableName: 'PracticeTools-prod-Releases',
          Key: {
            version: { S: release.version }
          }
        });
        
        await dynamoClient.send(deleteCommand);
        console.log(`   🗑️  Deleted: ${release.version}`);
        deletedCount++;
      } catch (error) {
        console.log(`   ❌ Failed to delete ${release.version}: ${error.message}`);
      }
    }
    
    console.log(`\n✅ Cleanup completed: ${deletedCount}/${devVersions.length} dev versions deleted`);
    console.log(`📦 Production database now contains only production versions`);
    
  } catch (error) {
    console.error('❌ Error cleaning production releases:', error.message);
  }
}

cleanProdReleases();