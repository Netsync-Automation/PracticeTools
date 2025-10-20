import { SSMClient, GetParameterCommand, PutParameterCommand } from '@aws-sdk/client-ssm';
import { getEnvironment } from './dynamodb.js';

const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

/**
 * Extract site prefix from site URL (e.g., netsync.webex.com -> NETSYNC)
 */
export function getSitePrefix(siteUrl) {
  const cleanUrl = siteUrl.replace(/^https?:\/\//, '');
  const siteName = cleanUrl.split('.')[0];
  return siteName.toUpperCase();
}

/**
 * Get SSM parameter path based on environment
 */
export function getSSMPath(parameterName) {
  const environment = getEnvironment();
  return environment === 'prod' 
    ? `/PracticeTools/${parameterName}`
    : `/PracticeTools/dev/${parameterName}`;
}

/**
 * Store Webex Meetings tokens in SSM
 */
export async function storeWebexTokens(siteUrl, accessToken, refreshToken) {
  const sitePrefix = getSitePrefix(siteUrl);
  
  const accessTokenPath = getSSMPath(`${sitePrefix}_WEBEX_MEETINGS_ACCESS_TOKEN`);
  const refreshTokenPath = getSSMPath(`${sitePrefix}_WEBEX_MEETINGS_REFRESH_TOKEN`);
  
  await Promise.all([
    ssmClient.send(new PutParameterCommand({
      Name: accessTokenPath,
      Value: accessToken,
      Type: 'String',
      Overwrite: true
    })),
    ssmClient.send(new PutParameterCommand({
      Name: refreshTokenPath,
      Value: refreshToken,
      Type: 'String',
      Overwrite: true
    }))
  ]);
}

/**
 * Retrieve Webex Meetings tokens from SSM
 */
export async function getWebexTokens(siteUrl) {
  const sitePrefix = getSitePrefix(siteUrl);
  
  const accessTokenPath = getSSMPath(`${sitePrefix}_WEBEX_MEETINGS_ACCESS_TOKEN`);
  const refreshTokenPath = getSSMPath(`${sitePrefix}_WEBEX_MEETINGS_REFRESH_TOKEN`);
  
  try {
    const [accessTokenResult, refreshTokenResult] = await Promise.all([
      ssmClient.send(new GetParameterCommand({
        Name: accessTokenPath
      })),
      ssmClient.send(new GetParameterCommand({
        Name: refreshTokenPath
      }))
    ]);
    
    return {
      accessToken: accessTokenResult.Parameter.Value,
      refreshToken: refreshTokenResult.Parameter.Value
    };
  } catch (error) {
    console.error(`Failed to retrieve tokens for ${siteUrl}:`, error);
    return null;
  }
}