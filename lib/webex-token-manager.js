import { SSMClient, GetParameterCommand, PutParameterCommand } from '@aws-sdk/client-ssm';
import { getEnvironment } from './dynamodb.js';

const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

function getParameterName(paramName) {
  const env = getEnvironment();
  return env === 'prod' ? `/PracticeTools/${paramName}` : `/PracticeTools/${env}/${paramName}`;
}

async function getValidAccessToken() {
  try {
    const accessToken = process.env.WEBEX_MEETINGS_ACCESS_TOKEN;
    
    // Test if current token is valid
    const testResponse = await fetch('https://webexapis.com/v1/people/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (testResponse.ok) {
      return accessToken;
    }
    
    // Token expired, refresh it
    console.log('Access token expired, refreshing...');
    return await refreshAccessToken();
  } catch (error) {
    console.error('Error validating token:', error);
    throw error;
  }
}

async function refreshAccessToken() {
  try {
    const clientId = process.env.WEBEX_MEETINGS_CLIENT_ID;
    const clientSecret = process.env.WEBEX_MEETINGS_CLIENT_SECRET;
    const refreshToken = process.env.WEBEX_MEETINGS_REFRESH_TOKEN;
    
    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Missing Webex credentials for token refresh');
    }
    
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
    
    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }
    
    const tokenData = await response.json();
    
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
    
    console.log('Webex tokens refreshed successfully');
    return tokenData.access_token;
  } catch (error) {
    console.error('Error refreshing token:', error);
    throw error;
  }
}

export { getValidAccessToken, refreshAccessToken };