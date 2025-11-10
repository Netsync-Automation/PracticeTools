import { SSMClient, GetParameterCommand, PutParameterCommand } from '@aws-sdk/client-ssm';

const ssmClient = new SSMClient({ region: 'us-east-1' });

async function getSSMParameter(name) {
  const command = new GetParameterCommand({ Name: name, WithDecryption: true });
  const response = await ssmClient.send(command);
  return response.Parameter?.Value;
}

async function putSSMParameter(name, value) {
  const command = new PutParameterCommand({
    Name: name,
    Value: value,
    Type: 'String',
    Overwrite: true
  });
  await ssmClient.send(command);
}

async function testToken(token) {
  try {
    const response = await fetch('https://webexapis.com/v1/people/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return { status: response.status, hasScope: response.status === 200 };
  } catch (error) {
    return { error: error.message };
  }
}

async function fixWebexToken() {
  const prefix = '/PracticeTools/dev';
  
  console.log('=== WEBEX TOKEN DIAGNOSTIC & FIX ===');
  
  // Get current tokens
  const [accessToken, refreshToken, clientId, clientSecret] = await Promise.all([
    getSSMParameter(`${prefix}/WEBEX_MEETINGS_ACCESS_TOKEN`),
    getSSMParameter(`${prefix}/WEBEX_MEETINGS_REFRESH_TOKEN`),
    getSSMParameter(`${prefix}/WEBEX_MEETINGS_CLIENT_ID`),
    getSSMParameter(`${prefix}/WEBEX_MEETINGS_CLIENT_SECRET`)
  ]);
  
  if (!accessToken) {
    console.log('❌ No access token found - need to authorize first');
    return;
  }
  
  // Test current token
  console.log('Testing current token...');
  const tokenTest = await testToken(accessToken);
  
  if (tokenTest.hasScope) {
    console.log('✅ Current token has spark:people_read scope - no fix needed');
    return;
  }
  
  if (tokenTest.status === 403) {
    console.log('❌ Current token missing spark:people_read scope');
    
    if (!refreshToken || !clientId || !clientSecret) {
      console.log('❌ Missing credentials for token refresh - need to re-authorize');
      return;
    }
    
    console.log('🔄 Attempting to refresh token with correct scopes...');
    
    // Refresh token with correct scopes
    try {
      const response = await fetch('https://webexapis.com/v1/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken
        })
      });
      
      if (response.ok) {
        const tokenData = await response.json();
        
        // Test new token
        const newTokenTest = await testToken(tokenData.access_token);
        
        if (newTokenTest.hasScope) {
          // Save new tokens
          await Promise.all([
            putSSMParameter(`${prefix}/WEBEX_MEETINGS_ACCESS_TOKEN`, tokenData.access_token),
            putSSMParameter(`${prefix}/WEBEX_MEETINGS_REFRESH_TOKEN`, tokenData.refresh_token)
          ]);
          
          console.log('✅ Token refreshed successfully with correct scopes');
          console.log('⚠️  App Runner restart required for changes to take effect');
        } else {
          console.log('❌ Refreshed token still missing scopes - need to re-authorize with updated OAuth flow');
        }
      } else {
        console.log('❌ Token refresh failed - need to re-authorize');
      }
    } catch (error) {
      console.log('❌ Token refresh error:', error.message);
    }
  } else {
    console.log('❌ Token test failed:', tokenTest.error || `Status ${tokenTest.status}`);
  }
}

fixWebexToken().catch(console.error);