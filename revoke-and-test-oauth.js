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

async function revokeCurrentToken() {
  console.log('🔍 ATTEMPTING TO REVOKE CURRENT TOKEN');
  console.log('====================================\n');
  
  const accessToken = await getSSMParameter('/PracticeTools/dev/WEBEX_MEETINGS_ACCESS_TOKEN');
  const clientId = await getSSMParameter('/PracticeTools/dev/WEBEX_MEETINGS_CLIENT_ID');
  const clientSecret = await getSSMParameter('/PracticeTools/dev/WEBEX_MEETINGS_CLIENT_SECRET');
  
  if (!accessToken || !clientId || !clientSecret) {
    console.log('❌ Missing required credentials');
    return false;
  }
  
  console.log(`✅ Current token: ${accessToken.substring(0, 30)}...`);
  
  try {
    console.log('📡 Attempting to revoke token...');
    
    // Try to revoke the token
    const revokeResponse = await fetch('https://webexapis.com/v1/access_token/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
      },
      body: `token=${accessToken}&token_type_hint=access_token`
    });
    
    console.log(`   Status: ${revokeResponse.status} ${revokeResponse.statusText}`);
    
    if (revokeResponse.ok || revokeResponse.status === 200) {
      console.log('✅ Token revoked successfully');
      return true;
    } else {
      const errorText = await revokeResponse.text();
      console.log(`❌ Revoke failed: ${errorText}`);
      return false;
    }
    
  } catch (error) {
    console.log(`❌ Revoke error: ${error.message}`);
    return false;
  }
}

async function generateFreshOAuthLinks() {
  console.log('\n🔗 FRESH OAUTH LINKS (After Token Revocation)');
  console.log('=============================================\n');
  
  const clientId = await getSSMParameter('/PracticeTools/dev/WEBEX_MEETINGS_CLIENT_ID');
  const baseUrl = await getSSMParameter('/PracticeTools/dev/NEXTAUTH_URL');
  
  const redirectUri = `${baseUrl}/api/webex-meetings/callback`;
  
  const freshTests = [
    {
      name: 'Fresh OAuth - Only Admin Scope',
      scopes: 'meeting:admin_transcripts_read',
      state: 'fresh_admin_only'
    },
    {
      name: 'Fresh OAuth - Admin + People',
      scopes: 'meeting:admin_transcripts_read spark:people_read',
      state: 'fresh_admin_people'
    },
    {
      name: 'Fresh OAuth - All Scopes',
      scopes: 'spark:recordings_read meeting:recordings_read meeting:transcripts_read meeting:admin_transcripts_read spark:people_read',
      state: 'fresh_all_scopes'
    }
  ];
  
  freshTests.forEach(test => {
    const oauthUrl = `https://webexapis.com/v1/authorize?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(test.scopes)}&` +
      `state=${encodeURIComponent(test.state)}`;
    
    console.log(`📋 ${test.name}:`);
    console.log(`   🔗 ${oauthUrl}\n`);
  });
}

async function testAlternativeOAuthEndpoint() {
  console.log('🔍 TESTING ALTERNATIVE OAUTH APPROACHES');
  console.log('=======================================\n');
  
  const clientId = await getSSMParameter('/PracticeTools/dev/WEBEX_MEETINGS_CLIENT_ID');
  const baseUrl = await getSSMParameter('/PracticeTools/dev/NEXTAUTH_URL');
  
  const redirectUri = `${baseUrl}/api/webex-meetings/callback`;
  
  // Test with different OAuth parameters
  const alternatives = [
    {
      name: 'With approval_prompt=force',
      params: `approval_prompt=force&access_type=offline`
    },
    {
      name: 'With prompt=select_account',
      params: `prompt=select_account`
    },
    {
      name: 'With include_granted_scopes=false',
      params: `include_granted_scopes=false`
    }
  ];
  
  console.log('🧪 ALTERNATIVE OAUTH PARAMETERS:');
  console.log('================================\n');
  
  alternatives.forEach(alt => {
    const oauthUrl = `https://webexapis.com/v1/authorize?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent('meeting:admin_transcripts_read')}&` +
      `state=alt_test&` +
      alt.params;
    
    console.log(`📋 ${alt.name}:`);
    console.log(`   🔗 ${oauthUrl}\n`);
  });
}

async function main() {
  console.log('🔍 COMPREHENSIVE OAUTH TROUBLESHOOTING');
  console.log('======================================\n');
  
  // Step 1: Try to revoke current token
  const revoked = await revokeCurrentToken();
  
  if (revoked) {
    console.log('\n✅ Token revoked! Now try the fresh OAuth links below.');
    console.log('   You should see a consent screen this time.\n');
  } else {
    console.log('\n⚠️  Token revocation failed or not supported.');
    console.log('   Try the alternative approaches below.\n');
  }
  
  // Step 2: Generate fresh OAuth links
  await generateFreshOAuthLinks();
  
  // Step 3: Test alternative OAuth parameters
  await testAlternativeOAuthEndpoint();
  
  console.log('🎯 TESTING STRATEGY:');
  console.log('====================');
  console.log('1. If token was revoked, try "Fresh OAuth - Only Admin Scope" first');
  console.log('2. If you see a consent screen, note which scopes are listed');
  console.log('3. If no consent screen, try the alternative parameter approaches');
  console.log('4. If still no consent screen, the issue is likely:');
  console.log('   - OAuth app configuration in Webex Developer Portal');
  console.log('   - User account lacks admin privileges for API access');
  console.log('   - Organization settings restrict admin API access');
}

main().catch(console.error);