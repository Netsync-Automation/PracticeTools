#!/usr/bin/env node

import { config } from 'dotenv';
import { db } from './lib/dynamodb.js';

// Load environment variables
config({ path: '.env.local' });

async function checkProdVersion() {
  try {
    console.log('🔍 Checking PracticeTools-prod-Releases table...\n');
    
    // Get all production releases by temporarily overriding environment
    const originalEnv = process.env.ENVIRONMENT;
    process.env.ENVIRONMENT = 'prod';
    
    const releases = await db.getReleases();
    
    // Restore original environment
    process.env.ENVIRONMENT = originalEnv;
    
    if (releases.length === 0) {
      console.log('❌ No releases found in production database');
      return;
    }
    
    console.log(`📊 Found ${releases.length} production releases:\n`);
    
    // Sort by version to show latest first
    const sortedReleases = releases.sort((a, b) => {
      const aVersion = a.version.replace('v', '').split('.').map(Number);
      const bVersion = b.version.replace('v', '').split('.').map(Number);
      
      for (let i = 0; i < 3; i++) {
        if (aVersion[i] !== bVersion[i]) {
          return bVersion[i] - aVersion[i];
        }
      }
      return 0;
    });
    
    // Show latest version prominently
    const latestRelease = sortedReleases[0];
    console.log(`🎯 CURRENT PRODUCTION VERSION: ${latestRelease.version}`);
    console.log(`📅 Released: ${latestRelease.date}`);
    console.log(`🏷️  Type: ${latestRelease.type || 'Release'}`);
    console.log(`⏰ Timestamp: ${latestRelease.timestamp}\n`);
    
    // Show all versions
    console.log('📋 All Production Versions:');
    sortedReleases.forEach((release, index) => {
      const indicator = index === 0 ? '👑' : '  ';
      console.log(`${indicator} ${release.version} - ${release.date} (${release.type || 'Release'})`);
    });
    
  } catch (error) {
    console.error('❌ Error checking production version:', error.message);
  }
}

checkProdVersion();