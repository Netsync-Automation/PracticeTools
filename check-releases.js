#!/usr/bin/env node

import { db } from './lib/dynamodb.js';

async function checkReleases() {
  try {
    console.log('🔍 Checking releases in database...');
    console.log('Environment:', process.env.ENVIRONMENT || 'prod');
    console.log('Table name:', `PracticeTools-${process.env.ENVIRONMENT || 'prod'}-Releases`);
    
    const releases = await db.getReleases();
    console.log('📊 Releases found:', releases ? releases.length : 0);
    
    if (releases && releases.length > 0) {
      console.log('\n📋 Latest 5 releases:');
      releases.slice(0, 5).forEach((r, i) => {
        console.log(`${i + 1}. Version: ${r.version} | Date: ${r.date} | Type: ${r.type}`);
        if (r.corrected_version) {
          console.log(`   Corrected: ${r.corrected_version}`);
        }
      });
      
      // Sort and find latest
      const allVersions = releases.map(release => {
        const displayVersion = release.corrected_version || release.version;
        return { version: displayVersion, release: release };
      });
      
      const latestVersionObj = allVersions.sort((a, b) => {
        const parseVersion = (version) => {
          const parts = version.split('.').map(Number);
          return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 };
        };
        
        const versionA = parseVersion(a.version);
        const versionB = parseVersion(b.version);
        
        if (versionB.major !== versionA.major) return versionB.major - versionA.major;
        if (versionB.minor !== versionA.minor) return versionB.minor - versionA.minor;
        return versionB.patch - versionA.patch;
      })[0];
      
      console.log('\n🎯 Latest version should be:', latestVersionObj.version);
    } else {
      console.log('❌ No releases found in database');
      console.log('💡 This explains why the API returns 1.0.0 as fallback');
    }
  } catch (error) {
    console.error('❌ Error checking releases:', error.message);
  }
}

checkReleases();