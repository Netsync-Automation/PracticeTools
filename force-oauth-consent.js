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

async function generateForceConsentLinks() {
  console.log('🔍 FORCE OAUTH CONSENT SCREEN');
  console.log('============================\n');
  
  const clientId = await getSSMParameter('/PracticeTools/dev/WEBEX_MEETINGS_CLIENT_ID');
  const baseUrl = await getSSMParameter('/PracticeTools/dev/NEXTAUTH_URL');
  
  if (!clientId || !baseUrl) {
    console.log('❌ Missing OAuth credentials');
    process.exit(1);
  }
  
  const redirectUri = `${baseUrl}/api/webex-meetings/callback`;
  
  // Force consent by adding prompt=consent parameter
  const forceConsentTests = [
    {
      name: 'Force Consent - All Scopes',
      scopes: 'spark:recordings_read meeting:recordings_read meeting:transcripts_read meeting:admin_transcripts_read spark:people_read',
      state: 'force_consent_all'
    },
    {
      name: 'Force Consent - Only Admin Scope',
      scopes: 'meeting:admin_transcripts_read',
      state: 'force_consent_admin'
    },
    {
      name: 'Force Consent - Without Admin',
      scopes: 'spark:recordings_read meeting:recordings_read meeting:transcripts_read spark:people_read',
      state: 'force_consent_no_admin'
    }
  ];
  
  console.log('🔗 FORCE CONSENT LINKS (These will show consent screen):');
  console.log('========================================================\n');
  
  forceConsentTests.forEach(test => {
    // Add prompt=consent to force the consent screen
    const oauthUrl = `https://webexapis.com/v1/authorize?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(test.scopes)}&` +
      `state=${encodeURIComponent(test.state)}&` +
      `prompt=consent`;
    
    console.log(`📋 ${test.name}:`);
    console.log(`   🔗 ${oauthUrl}\n`);
  });
  
  console.log('🧪 ALTERNATIVE TESTING METHODS:');
  console.log('===============================');
  console.log('1. **Revoke App Access First:**');
  console.log('   - Go to https://developer.webex.com/my-apps');
  console.log('   - Find your OAuth app');
  console.log('   - Revoke access for mbgriffin@netsync.com');
  console.log('   - Then try the original OAuth links again\n');
  
  console.log('2. **Use Different Browser/Incognito:**');
  console.log('   - Open incognito/private browser window');
  console.log('   - Login as mbgriffin@netsync.com');
  console.log('   - Try the OAuth links\n');
  
  console.log('3. **Check Current Token Scopes:**');
  console.log('   - The fact that no consent screen appears means');
  console.log('   - Webex believes it already granted these scopes');
  console.log('   - But the token may not have actual admin privileges\n');
  
  // Generate logout + OAuth link
  const logoutOAuthUrl = `https://webexapis.com/v1/authorize?` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `response_type=code&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `scope=${encodeURIComponent('meeting:admin_transcripts_read spark:people_read')}&` +
    `state=after_logout&` +
    `prompt=login`;
  
  console.log('🔓 FORCE LOGIN + CONSENT:');
  console.log('========================');
  console.log('This link will force login and then show consent:');
  console.log(`🔗 ${logoutOAuthUrl}\n`);
  
  console.log('🎯 WHAT THIS TELLS US:');
  console.log('======================');
  console.log('If you STILL don\'t see a consent screen with prompt=consent:');
  console.log('✅ The OAuth app is correctly configured');
  console.log('✅ The user can access these scopes');
  console.log('❌ The issue is user privileges, not OAuth configuration');
  console.log('');
  console.log('If you DO see a consent screen:');
  console.log('🔍 Check which scopes are actually listed');
  console.log('🔍 Look for admin permission warnings');
  console.log('🔍 Note any missing scopes from the request');
}

async function checkCurrentTokenDetails() {
  console.log('\n🔍 CURRENT TOKEN ANALYSIS:');
  console.log('=========================');
  
  const accessToken = await getSSMParameter('/PracticeTools/dev/WEBEX_MEETINGS_ACCESS_TOKEN');
  
  if (!accessToken) {
    console.log('❌ No access token found');
    return;
  }
  
  console.log(`✅ Current token: ${accessToken.substring(0, 30)}...`);
  
  // Test the token against a simple endpoint to see what user it represents
  try {
    const response = await fetch('https://webexapis.com/v1/people/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const userData = await response.json();
      console.log(`✅ Token belongs to: ${userData.displayName} (${userData.emails[0]})`);
      console.log(`✅ User ID: ${userData.id}`);
      console.log(`✅ Org ID: ${userData.orgId}`);
      
      // Check if this matches the expected user
      if (userData.emails[0] === 'mbgriffin@netsync.com') {
        console.log('✅ Token is for the correct user');
      } else {
        console.log('⚠️  Token is for a different user than expected!');
      }
    } else {
      console.log('❌ Token validation failed');
    }
  } catch (error) {
    console.log(`❌ Error validating token: ${error.message}`);
  }
}

async function main() {
  await generateForceConsentLinks();
  await checkCurrentTokenDetails();
  
  console.log('\n🎯 NEXT STEPS:');
  console.log('=============');
  console.log('1. Try the "Force Consent - Only Admin Scope" link above');
  console.log('2. If no consent screen appears, the issue is user privileges');
  console.log('3. If consent screen appears, check what scopes are shown');
  console.log('4. Report back what you observe!');
}

main().catch(console.error);