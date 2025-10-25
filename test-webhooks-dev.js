#!/usr/bin/env node

/**
 * Webhook Testing Utility for Dev Environment
 * Tests webhook configuration and connectivity
 */

import fetch from 'node-fetch';

const DEV_BASE_URL = 'http://localhost:3000';

async function testWebhooks() {
  console.log('🧪 Testing Webex Meetings Webhooks in Dev Environment');
  console.log('=' .repeat(60));
  
  try {
    // Test 1: Validate webhook configuration
    console.log('\n📋 Step 1: Validating webhook configuration...');
    const validateResponse = await fetch(`${DEV_BASE_URL}/api/webexmeetings/settings/webhookmgmt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'validate' })
    });
    
    if (!validateResponse.ok) {
      console.error('❌ Validation failed:', validateResponse.status, validateResponse.statusText);
      const errorText = await validateResponse.text();
      console.error('Error details:', errorText);
      return;
    }
    
    const validationResults = await validateResponse.json();
    console.log('✅ Validation completed');
    
    // Display results for each site
    for (const result of validationResults.results) {
      console.log(`\n🌐 Site: ${result.site}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Has Both Webhooks: ${result.hasBothWebhooks ? '✅' : '❌'}`);
      console.log(`   Recordings Webhook: ${result.recordingsWebhook}`);
      console.log(`   Transcripts Webhook: ${result.transcriptsWebhook}`);
      console.log(`   Total Webhooks: ${result.webhookCount}`);
      
      if (result.webhookDetails?.recordings) {
        console.log(`   📹 Recordings Webhook ID: ${result.webhookDetails.recordings.id}`);
        console.log(`   📹 Status: ${result.webhookDetails.recordings.status}`);
        console.log(`   📹 Target URL: ${result.webhookDetails.recordings.targetUrl}`);
      }
      
      if (result.webhookDetails?.transcripts) {
        console.log(`   📝 Transcripts Webhook ID: ${result.webhookDetails.transcripts.id}`);
        console.log(`   📝 Status: ${result.webhookDetails.transcripts.status}`);
        console.log(`   📝 Target URL: ${result.webhookDetails.transcripts.targetUrl}`);
      }
      
      if (result.connectivity?.length > 0) {
        console.log(`   🔗 Connectivity Tests:`);
        for (const test of result.connectivity) {
          console.log(`      ${test.endpoint}: ${test.reachable ? '✅' : '❌'}`);
          if (test.error) {
            console.log(`         Error: ${test.error}`);
          }
        }
      }
    }
    
    // Test 2: Test webhook endpoints directly
    console.log('\n📋 Step 2: Testing webhook endpoints directly...');
    
    const testEndpoints = [
      '/api/webhooks/webexmeetings/test',
      '/api/webhooks/webexmeetings/recordings',
      '/api/webhooks/webexmeetings/transcripts'
    ];
    
    for (const endpoint of testEndpoints) {
      try {
        console.log(`\n🔍 Testing ${endpoint}...`);
        
        // Test GET request
        const getResponse = await fetch(`${DEV_BASE_URL}${endpoint}`, {
          method: 'GET'
        });
        console.log(`   GET: ${getResponse.ok ? '✅' : '❌'} (${getResponse.status})`);
        
        // Test POST request with sample data
        const postResponse = await fetch(`${DEV_BASE_URL}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            test: true,
            timestamp: new Date().toISOString(),
            source: 'webhook-test-utility'
          })
        });
        console.log(`   POST: ${postResponse.ok ? '✅' : '❌'} (${postResponse.status})`);
        
        if (postResponse.ok) {
          const responseData = await postResponse.json();
          if (responseData.success) {
            console.log(`   ✅ Endpoint is responding correctly`);
          }
        }
        
      } catch (error) {
        console.log(`   ❌ Error testing ${endpoint}: ${error.message}`);
      }
    }
    
    // Test 3: Check if dev server is running
    console.log('\n📋 Step 3: Checking dev server status...');
    try {
      const healthResponse = await fetch(`${DEV_BASE_URL}/api/health`, {
        method: 'GET'
      });
      console.log(`   Dev Server: ${healthResponse.ok ? '✅ Running' : '❌ Issues'} (${healthResponse.status})`);
    } catch (error) {
      console.log(`   ❌ Dev server not reachable: ${error.message}`);
      console.log('   💡 Make sure to run "npm run dev" first');
    }
    
    console.log('\n🎉 Webhook testing completed!');
    console.log('\n💡 Tips:');
    console.log('   - Ensure dev server is running with "npm run dev"');
    console.log('   - Check that webhooks were created with client credentials');
    console.log('   - Verify SSM parameters are properly configured');
    console.log('   - Test actual webhook delivery by creating a meeting');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testWebhooks().catch(console.error);