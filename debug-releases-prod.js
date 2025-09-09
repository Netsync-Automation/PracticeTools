#!/usr/bin/env node

/**
 * Production Release Notes Debugging Script
 * 
 * This script systematically diagnoses the release notes issue in production
 */

console.log('=== PRODUCTION RELEASE NOTES DIAGNOSTIC ===\n');

// Test 1: Environment Detection
console.log('1. ENVIRONMENT DETECTION:');
console.log('   process.env.NODE_ENV:', process.env.NODE_ENV);
console.log('   process.env.ENVIRONMENT:', process.env.ENVIRONMENT);

// Test 2: Database Table Selection
console.log('\n2. DATABASE TABLE SELECTION:');
const ENV = process.env.ENVIRONMENT === 'prod' ? 'prod' : 'dev';
console.log('   Computed ENV:', ENV);
console.log('   Expected table:', `PracticeTools-${ENV}-Releases`);

// Test 3: API Endpoints
async function testAPIs() {
  console.log('\n3. API ENDPOINT TESTS:');
  
  try {
    // Test environment API
    console.log('   Testing /api/environment...');
    const envResponse = await fetch('https://cfm2pd2zmq.us-east-1.awsapprunner.com/api/environment');
    const envData = await envResponse.json();
    console.log('   Environment API response:', envData);
    
    // Test version API
    console.log('   Testing /api/version...');
    const versionResponse = await fetch('https://cfm2pd2zmq.us-east-1.awsapprunner.com/api/version');
    const versionData = await versionResponse.json();
    console.log('   Version API response:', versionData);
    
    // Test releases API
    console.log('   Testing /api/releases...');
    const releasesResponse = await fetch('https://cfm2pd2zmq.us-east-1.awsapprunner.com/api/releases');
    const releasesData = await releasesResponse.json();
    console.log('   Releases API response count:', releasesData.length);
    console.log('   Sample releases:', releasesData.slice(0, 2).map(r => ({ 
      version: r.version, 
      notes: r.notes ? r.notes.substring(0, 50) + '...' : 'No notes' 
    })));
    
  } catch (error) {
    console.error('   API test error:', error.message);
  }
}

// Test 4: Database Direct Access
async function testDatabase() {
  console.log('\n4. DATABASE DIRECT ACCESS:');
  
  try {
    const { db } = await import('./lib/dynamodb.js');
    
    console.log('   Testing getReleases(prod)...');
    const prodReleases = await db.getReleases('prod');
    console.log('   Production releases found:', prodReleases.length);
    
    console.log('   Testing getReleases(dev)...');
    const devReleases = await db.getReleases('dev');
    console.log('   Development releases found:', devReleases.length);
    
    if (prodReleases.length > 0) {
      console.log('   Sample prod release:', {
        version: prodReleases[0].version,
        notes: prodReleases[0].notes ? prodReleases[0].notes.substring(0, 50) + '...' : 'No notes'
      });
    }
    
  } catch (error) {
    console.error('   Database test error:', error.message);
  }
}

// Run all tests
async function runDiagnostics() {
  await testAPIs();
  await testDatabase();
  
  console.log('\n=== DIAGNOSTIC COMPLETE ===');
  console.log('\nNext steps:');
  console.log('1. Check if production table exists: PracticeTools-prod-Releases');
  console.log('2. Verify environment variable is set correctly in App Runner');
  console.log('3. Check if releases are being filtered correctly by environment');
}

runDiagnostics().catch(console.error);