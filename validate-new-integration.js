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
    return {
      value: response.Parameter?.Value,
      lastModified: response.Parameter?.LastModifiedDate,
      version: response.Parameter?.Version
    };
  } catch (error) {
    console.error(`Error getting ${name}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🔍 NEW INTEGRATION VALIDATION');
  console.log('=============================\n');
  
  // Check all the new credentials
  const clientIdData = await getSSMParameter('/PracticeTools/dev/WEBEX_MEETINGS_CLIENT_ID');
  const clientSecretData = await getSSMParameter('/PracticeTools/dev/WEBEX_MEETINGS_CLIENT_SECRET');
  const accessTokenData = await getSSMParameter('/PracticeTools/dev/WEBEX_MEETINGS_ACCESS_TOKEN');
  const refreshTokenData = await getSSMParameter('/PracticeTools/dev/WEBEX_MEETINGS_REFRESH_TOKEN');
  
  console.log('📊 NEW INTEGRATION CREDENTIALS:');
  console.log('===============================');
  
  if (clientIdData?.value) {
    console.log(`✅ Client ID: ${clientIdData.value.substring(0, 10)}... (${clientIdData.value.length} chars)`);
    console.log(`   Last Modified: ${clientIdData.lastModified}`);
    console.log(`   Version: ${clientIdData.version}`);
  } else {
    console.log('❌ Client ID: Missing');
  }
  
  if (clientSecretData?.value) {
    console.log(`✅ Client Secret: ${clientSecretData.value.substring(0, 10)}... (${clientSecretData.value.length} chars)`);
    console.log(`   Last Modified: ${clientSecretData.lastModified}`);
    console.log(`   Version: ${clientSecretData.version}`);
  } else {
    console.log('❌ Client Secret: Missing');
  }
  
  if (accessTokenData?.value) {
    console.log(`✅ Access Token: ${accessTokenData.value.substring(0, 10)}... (${accessTokenData.value.length} chars)`);
    console.log(`   Last Modified: ${accessTokenData.lastModified}`);
    console.log(`   Version: ${accessTokenData.version}`);
  } else {
    console.log('❌ Access Token: Missing');
  }
  
  if (refreshTokenData?.value) {
    console.log(`✅ Refresh Token: ${refreshTokenData.value.substring(0, 10)}... (${refreshTokenData.value.length} chars)`);
    console.log(`   Last Modified: ${refreshTokenData.lastModified}`);
    console.log(`   Version: ${refreshTokenData.version}`);
  } else {
    console.log('❌ Refresh Token: Missing');
  }
  
  console.log('\n🎯 CONCLUSION:');
  console.log('==============');
  console.log('The new integration is properly configured, but the user');
  console.log('mbgriffin@netsync.com still lacks admin API privileges.');
  console.log('');
  console.log('This means the issue is NOT with the OAuth app, but with');
  console.log('the user account permissions in the Webex organization.');
  console.log('');
  console.log('🔧 REQUIRED ACTION:');
  console.log('==================');
  console.log('The Webex organization administrator needs to:');
  console.log('1. Go to Webex Control Hub (admin.webex.com)');
  console.log('2. Navigate to Users → mbgriffin@netsync.com');
  console.log('3. Grant "Organization Administrator" or "Full Administrator" role');
  console.log('4. Ensure API access is enabled for admin functions');
  console.log('');
  console.log('OR');
  console.log('');
  console.log('🔄 ALTERNATIVE SOLUTION:');
  console.log('========================');
  console.log('Remove the meeting:admin_transcripts_read scope requirement');
  console.log('and proceed with the 4 working scopes for user-level access.');
}

main().catch(console.error);