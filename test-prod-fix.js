#!/usr/bin/env node

/**
 * Production Fix Test Script
 * 
 * Tests the release notes fix in production environment
 */

console.log('=== TESTING PRODUCTION RELEASE NOTES FIX ===\n');

async function testProductionFix() {
  console.log('1. Testing Environment API...');
  try {
    const envResponse = await fetch('https://cfm2pd2zmq.us-east-1.awsapprunner.com/api/environment');
    const envData = await envResponse.json();
    console.log('   ✅ Environment API:', envData);
  } catch (error) {
    console.log('   ❌ Environment API failed:', error.message);
  }

  console.log('\n2. Testing Version API...');
  try {
    const versionResponse = await fetch('https://cfm2pd2zmq.us-east-1.awsapprunner.com/api/version');
    const versionData = await versionResponse.json();
    console.log('   ✅ Version API:', versionData);
  } catch (error) {
    console.log('   ❌ Version API failed:', error.message);
  }

  console.log('\n3. Testing Releases API (MAIN TEST)...');
  try {
    const releasesResponse = await fetch('https://cfm2pd2zmq.us-east-1.awsapprunner.com/api/releases');
    
    if (!releasesResponse.ok) {
      console.log('   ❌ Releases API HTTP error:', releasesResponse.status, releasesResponse.statusText);
      return;
    }
    
    const releasesData = await releasesResponse.json();
    console.log('   ✅ Releases API response received');
    console.log('   📊 Total releases found:', releasesData.length);
    
    if (releasesData.length > 0) {
      console.log('   📋 Latest releases:');
      releasesData.slice(0, 3).forEach((release, index) => {
        console.log(`      ${index + 1}. ${release.version} (${release.type || 'Release'})`);
        console.log(`         Date: ${release.date}`);
        console.log(`         Notes: ${release.notes ? release.notes.substring(0, 100) + '...' : 'No notes'}`);
      });
      
      // Check for production vs development releases
      const prodReleases = releasesData.filter(r => !r.version.includes('-dev.'));
      const devReleases = releasesData.filter(r => r.version.includes('-dev.'));
      
      console.log(`   🏭 Production releases: ${prodReleases.length}`);
      console.log(`   🔧 Development releases: ${devReleases.length}`);
      
      if (prodReleases.length > 0) {
        console.log('   ✅ SUCCESS: Production releases are being returned!');
      } else {
        console.log('   ⚠️  WARNING: Only development releases found');
      }
    } else {
      console.log('   ❌ ISSUE: No releases returned from API');
    }
    
  } catch (error) {
    console.log('   ❌ Releases API failed:', error.message);
  }

  console.log('\n4. Testing Release Notes Page...');
  try {
    const pageResponse = await fetch('https://cfm2pd2zmq.us-east-1.awsapprunner.com/release-notes');
    if (pageResponse.ok) {
      console.log('   ✅ Release notes page loads successfully');
    } else {
      console.log('   ❌ Release notes page failed:', pageResponse.status);
    }
  } catch (error) {
    console.log('   ❌ Release notes page error:', error.message);
  }

  console.log('\n=== TEST COMPLETE ===');
  console.log('\nIf you see production releases above, the fix is working!');
  console.log('If not, check the App Runner logs for detailed debugging information.');
}

testProductionFix().catch(console.error);