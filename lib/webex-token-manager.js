import { SSMClient, GetParameterCommand, PutParameterCommand } from '@aws-sdk/client-ssm';
import { getEnvironment } from './dynamodb.js';

const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

function getParameterName(paramName) {
  const env = getEnvironment();
  return env === 'prod' ? `/PracticeTools/${paramName}` : `/PracticeTools/${env}/${paramName}`;
}

async function getValidAccessToken() {
  console.log('[WEBEX-TOKEN] Starting token validation');
  console.log('[WEBEX-TOKEN] Environment:', getEnvironment());
  try {
    const accessToken = process.env.WEBEX_MEETINGS_ACCESS_TOKEN;
    console.log('[WEBEX-TOKEN] Access token exists:', !!accessToken);
    console.log('[WEBEX-TOKEN] Access token length:', accessToken?.length || 0);
    
    if (!accessToken) {
      console.log('[WEBEX-TOKEN] No access token in environment variables');
      throw new Error('No access token available in environment');
    }
    
    // Test if current token is valid
    console.log('[WEBEX-TOKEN] Testing token validity');
    const testResponse = await fetch('https://webexapis.com/v1/people/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    console.log('[WEBEX-TOKEN] Test response status:', testResponse.status);
    
    if (testResponse.ok) {
      console.log('[WEBEX-TOKEN] Token is valid');
      return accessToken;
    }
    
    // Token expired, refresh it
    console.log('[WEBEX-TOKEN] Token expired, refreshing...');
    return await refreshAccessToken();
  } catch (error) {
    console.error('[WEBEX-TOKEN] Error validating token:', error);
    throw error;
  }
}

async function refreshAccessToken() {
  console.log('[WEBEX-REFRESH] Starting token refresh');
  try {
    const clientId = process.env.WEBEX_MEETINGS_CLIENT_ID;
    const clientSecret = process.env.WEBEX_MEETINGS_CLIENT_SECRET;
    const refreshToken = process.env.WEBEX_MEETINGS_REFRESH_TOKEN;
    
    console.log('[WEBEX-REFRESH] ClientId present:', !!clientId);
    console.log('[WEBEX-REFRESH] ClientSecret present:', !!clientSecret);
    console.log('[WEBEX-REFRESH] RefreshToken present:', !!refreshToken);
    
    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Missing Webex credentials for token refresh');
    }
    
    console.log('[WEBEX-REFRESH] Making refresh request to Webex API');
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
    
    console.log('[WEBEX-REFRESH] Refresh response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('[WEBEX-REFRESH] Refresh error response:', errorText);
      throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
    }
    
    const tokenData = await response.json();
    console.log('[WEBEX-REFRESH] New token received, length:', tokenData.access_token?.length || 0);
    
    // Update SSM parameters
    await Promise.all([
      ssmClient.send(new PutParameterCommand({
        Name: getParameterName('WEBEX_MEETINGS_ACCESS_TOKEN'),
        Value: tokenData.access_token,
        Type: 'String',
        Overwrite: true
      })),
      ssmClient.send(new PutParameterCommand({
        Name: getParameterName('WEBEX_MEETINGS_REFRESH_TOKEN'),
        Value: tokenData.refresh_token,
        Type: 'String',
        Overwrite: true
      }))
    ]);
    
    console.log('[WEBEX-REFRESH] Tokens refreshed and stored in SSM successfully');
    return tokenData.access_token;
  } catch (error) {
    console.error('[WEBEX-REFRESH] Error refreshing token:', error);
    throw error;
  }
}

export { getValidAccessToken, refreshAccessToken };