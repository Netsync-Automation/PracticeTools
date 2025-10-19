#!/usr/bin/env node

import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssmClient = new SSMClient({ region: 'us-east-1' });

async function getSSMParameter(name) {
  try {
    const command = new GetParameterCommand({
      Name: name,
      WithDecryption: true
    });
    const response = await ssmClient.send(command);
    return response.Parameter?.Value;
  } catch (error) {
    console.error(`Error getting ${name}:`, error.message);
    return null;
  }
}

async function testTokenScopes(accessToken) {
  console.log('\n🔍 Testing current access token scopes...\n');
  
  const scopeTests = [
    { name: 'spark:people_read', url: 'https://webexapis.com/v1/people/me' },
    { name: 'spark:recordings_read', url: 'https://webexapis.com/v1/recordings?max=1' },
    { name: 'meeting:recordings_read', url: 'https://webexapis.com/v1/recordings?max=1' },
    { name: 'meeting:transcripts_read', url: 'https://webexapis.com/v1/meetingTranscripts?max=1' },
    { name: 'meeting:admin_transcripts_read', url: 'https://webexapis.com/v1/admin/meetingTranscripts?max=1' }
  ];
  
  const results = [];
  
  for (const test of scopeTests) {
    try {
      const response = await fetch(test.url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      const status = response.status;
      const success = response.ok;
      
      let result = `${test.name}: `;
      if (status === 200) {
        result += '✅ GRANTED';
      } else if (status === 403) {
        result += '❌ MISSING (403 Forbidden)';
      } else if (status === 401) {
        result += '🔒 TOKEN INVALID (401 Unauthorized)';
      } else {
        result += `⚠️  ERROR (${status})`;
      }
      
      console.log(result);
      results.push({ scope: test.name, status, success });
      
    } catch (error) {
      console.log(`${test.name}: ❌ NETWORK ERROR - ${error.message}`);
      results.push({ scope: test.name, status: 'error', success: false, error: error.message });
    }
  }
  
  return results;
}

async function main() {
  console.log('🔍 WEBEX ACCESS TOKEN SCOPE CHECKER');
  console.log('=====================================\n');
  
  // Get access token from SSM
  console.log('📡 Retrieving access token from SSM...');
  const accessToken = await getSSMParameter('/PracticeTools/dev/WEBEX_MEETINGS_ACCESS_TOKEN');
  
  if (!accessToken) {
    console.log('❌ No access token found in SSM parameter: /PracticeTools/dev/WEBEX_MEETINGS_ACCESS_TOKEN');
    console.log('   This confirms we need to run OAuth to get a token with the admin scope.');
    process.exit(1);
  }
  
  console.log(`✅ Access token found (${accessToken.length} characters)`);
  console.log(`   Token preview: ${accessToken.substring(0, 20)}...`);
  
  // Test all required scopes
  const results = await testTokenScopes(accessToken);
  
  // Summary
  console.log('\n📊 SCOPE SUMMARY:');
  console.log('==================');
  
  const granted = results.filter(r => r.success).length;
  const missing = results.filter(r => r.status === 403).length;
  const errors = results.filter(r => !r.success && r.status !== 403).length;
  
  console.log(`✅ Granted scopes: ${granted}/5`);
  console.log(`❌ Missing scopes: ${missing}/5`);
  console.log(`⚠️  Error scopes: ${errors}/5`);
  
  const missingScopes = results.filter(r => r.status === 403).map(r => r.scope);
  if (missingScopes.length > 0) {
    console.log(`\n🎯 MISSING SCOPES: ${missingScopes.join(', ')}`);
    console.log('   These scopes need to be added via OAuth re-authorization.');
  }
  
  const adminScopeResult = results.find(r => r.scope === 'meeting:admin_transcripts_read');
  if (adminScopeResult) {
    console.log(`\n🔑 ADMIN TRANSCRIPT SCOPE STATUS: ${adminScopeResult.success ? 'GRANTED ✅' : 'MISSING ❌'}`);
    if (!adminScopeResult.success) {
      console.log('   This is the scope we need to add via OAuth!');
    }
  }
  
  console.log('\n🚀 NEXT STEPS:');
  if (missing > 0) {
    console.log('   1. Deploy the OAuth debugging code to App Runner');
    console.log('   2. Click "Authorize Webex" to re-authorize with missing scopes');
    console.log('   3. Check the logs to see if OAuth flow completes successfully');
  } else {
    console.log('   ✅ All scopes are present! No OAuth re-authorization needed.');
  }
}

main().catch(console.error);