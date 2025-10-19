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

async function generateManualOAuthTest() {
  console.log('🔍 MANUAL OAUTH TEST LINK GENERATOR');
  console.log('==================================\n');
  
  // Get OAuth credentials
  const clientId = await getSSMParameter('/PracticeTools/dev/WEBEX_MEETINGS_CLIENT_ID');
  const baseUrl = await getSSMParameter('/PracticeTools/dev/NEXTAUTH_URL');
  
  if (!clientId || !baseUrl) {
    console.log('❌ Missing OAuth credentials');
    process.exit(1);
  }
  
  console.log(`✅ Client ID: ${clientId.substring(0, 10)}...`);
  console.log(`✅ Base URL: ${baseUrl}\n`);
  
  const redirectUri = `${baseUrl}/api/webex-meetings/callback`;
  
  // Test different scope combinations
  const scopeTests = [
    {
      name: 'All Scopes (Current)',
      scopes: 'spark:recordings_read meeting:recordings_read meeting:transcripts_read meeting:admin_transcripts_read spark:people_read'
    },
    {
      name: 'Without Admin Scope',
      scopes: 'spark:recordings_read meeting:recordings_read meeting:transcripts_read spark:people_read'
    },
    {
      name: 'Only Admin Scope',
      scopes: 'meeting:admin_transcripts_read'
    },
    {
      name: 'Admin + Basic',
      scopes: 'meeting:admin_transcripts_read spark:people_read'
    }
  ];
  
  console.log('🔗 MANUAL OAUTH TEST LINKS:\n');
  
  scopeTests.forEach((test, index) => {
    const state = `manual_test_${index + 1}`;
    const oauthUrl = `https://webexapis.com/v1/authorize?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(test.scopes)}&` +
      `state=${encodeURIComponent(state)}`;
    
    console.log(`📋 ${test.name}:`);
    console.log(`   Scopes: ${test.scopes}`);
    console.log(`   State: ${state}`);
    console.log(`   🔗 URL: ${oauthUrl}\n`);
  });
  
  console.log('🧪 MANUAL TESTING INSTRUCTIONS:');
  console.log('==============================');
  console.log('1. Copy one of the OAuth URLs above');
  console.log('2. Open it in a browser where mbgriffin@netsync.com is logged in');
  console.log('3. Observe what happens during authorization:');
  console.log('   - Does Webex show the consent screen?');
  console.log('   - Are all requested scopes listed?');
  console.log('   - Does it show any warnings about admin permissions?');
  console.log('   - Does the user get prompted to grant admin access?');
  console.log('4. Check the callback URL parameters after authorization');
  console.log('5. Look for any error messages or scope limitations\n');
  
  console.log('🔍 WHAT TO LOOK FOR:');
  console.log('====================');
  console.log('✅ SUCCESS: All scopes appear in consent screen and are granted');
  console.log('⚠️  PARTIAL: Some scopes missing from consent screen');
  console.log('❌ FAILURE: Admin scope rejected or not shown');
  console.log('🚫 ERROR: Authorization fails completely\n');
  
  console.log('📊 DEBUGGING CALLBACK:');
  console.log('======================');
  console.log('After clicking "Allow", check the callback URL for:');
  console.log('- code=... (authorization code)');
  console.log('- state=... (should match the state above)');
  console.log('- error=... (any error messages)');
  console.log('- error_description=... (detailed error info)\n');
  
  // Generate a simple test page
  const testPageHtml = `<!DOCTYPE html>
<html>
<head>
    <title>Webex OAuth Manual Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .test-link { 
            display: block; 
            margin: 20px 0; 
            padding: 15px; 
            background: #f0f0f0; 
            border-radius: 5px;
            text-decoration: none;
            color: #333;
        }
        .test-link:hover { background: #e0e0e0; }
        .scopes { font-size: 12px; color: #666; margin-top: 5px; }
    </style>
</head>
<body>
    <h1>Webex OAuth Manual Test</h1>
    <p>Click the links below to test different OAuth scope combinations:</p>
    
    ${scopeTests.map((test, index) => {
      const state = `manual_test_${index + 1}`;
      const oauthUrl = `https://webexapis.com/v1/authorize?` +
        `client_id=${encodeURIComponent(clientId)}&` +
        `response_type=code&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(test.scopes)}&` +
        `state=${encodeURIComponent(state)}`;
      
      return `
        <a href="${oauthUrl}" class="test-link" target="_blank">
            <strong>${test.name}</strong>
            <div class="scopes">Scopes: ${test.scopes}</div>
            <div class="scopes">State: ${state}</div>
        </a>
      `;
    }).join('')}
    
    <h2>Instructions:</h2>
    <ol>
        <li>Make sure you're logged into Webex as mbgriffin@netsync.com</li>
        <li>Click each test link above</li>
        <li>Observe the consent screen carefully</li>
        <li>Note which scopes are shown vs requested</li>
        <li>Check for any admin permission warnings</li>
        <li>Complete the authorization and check the callback URL</li>
    </ol>
</body>
</html>`;
  
  console.log('📄 GENERATING TEST PAGE...');
  return testPageHtml;
}

async function main() {
  const testPageHtml = await generateManualOAuthTest();
  
  // Write the test page to a file
  const fs = await import('fs');
  fs.writeFileSync('webex-oauth-manual-test.html', testPageHtml);
  
  console.log('✅ Test page generated: webex-oauth-manual-test.html');
  console.log('📂 Open this file in a browser to run manual OAuth tests');
}

main().catch(console.error);