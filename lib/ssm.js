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
 * Retrieve Webex Meetings tokens from SSM using environment-aware paths
 */
export async function getWebexTokens(siteUrl) {
  const sitePrefix = getSitePrefix(siteUrl);
  const environment = getEnvironment();
  
  const accessTokenPath = environment === 'prod' 
    ? `/PracticeTools/${sitePrefix}_WEBEX_MEETINGS_ACCESS_TOKEN`
    : `/PracticeTools/dev/${sitePrefix}_WEBEX_MEETINGS_ACCESS_TOKEN`;
    
  const refreshTokenPath = environment === 'prod'
    ? `/PracticeTools/${sitePrefix}_WEBEX_MEETINGS_REFRESH_TOKEN`
    : `/PracticeTools/dev/${sitePrefix}_WEBEX_MEETINGS_REFRESH_TOKEN`;
  
  console.error(`[SSM-DEBUG] getWebexTokens: siteUrl=${siteUrl} sitePrefix=${sitePrefix} env=${environment}`);
  console.error(`[SSM-DEBUG] Fetching from SSM: ${accessTokenPath}`);
  console.error(`[SSM-DEBUG] Fetching from SSM: ${refreshTokenPath}`);
  
  try {
    const [accessTokenResult, refreshTokenResult] = await Promise.all([
      ssmClient.send(new GetParameterCommand({
        Name: accessTokenPath,
        WithDecryption: true
      })),
      ssmClient.send(new GetParameterCommand({
        Name: refreshTokenPath,
        WithDecryption: true
      }))
    ]);
    
    console.error(`[SSM-DEBUG] SSM fetch successful: accessToken.length=${accessTokenResult.Parameter.Value?.length}`);
    
    return {
      accessToken: accessTokenResult.Parameter.Value,
      refreshToken: refreshTokenResult.Parameter.Value
    };
  } catch (error) {
    console.error(`[SSM-DEBUG] Failed to retrieve tokens for ${siteUrl} from ${accessTokenPath}, ${refreshTokenPath}:`, error.message);
    return null;
  }
}

/**
 * Store Webex Meetings client credentials in SSM
 */
export async function storeWebexCredentials(siteUrl, clientId, clientSecret) {
  const sitePrefix = getSitePrefix(siteUrl);
  
  const clientIdPath = getSSMPath(`${sitePrefix}_WEBEX_MEETINGS_CLIENT_ID`);
  const clientSecretPath = getSSMPath(`${sitePrefix}_WEBEX_MEETINGS_CLIENT_SECRET`);
  
  await Promise.all([
    ssmClient.send(new PutParameterCommand({
      Name: clientIdPath,
      Value: clientId,
      Type: 'String',
      Overwrite: true
    })),
    ssmClient.send(new PutParameterCommand({
      Name: clientSecretPath,
      Value: clientSecret,
      Type: 'String',
      Overwrite: true
    }))
  ]);
}

/**
 * Retrieve Webex Meetings client credentials from SSM
 */
export async function getWebexCredentials(siteUrl) {
  const sitePrefix = getSitePrefix(siteUrl);
  const environment = getEnvironment();
  
  const clientIdPath = environment === 'prod' 
    ? `/PracticeTools/${sitePrefix}_WEBEX_MEETINGS_CLIENT_ID`
    : `/PracticeTools/dev/${sitePrefix}_WEBEX_MEETINGS_CLIENT_ID`;
    
  const clientSecretPath = environment === 'prod'
    ? `/PracticeTools/${sitePrefix}_WEBEX_MEETINGS_CLIENT_SECRET`
    : `/PracticeTools/dev/${sitePrefix}_WEBEX_MEETINGS_CLIENT_SECRET`;
  
  try {
    const [clientIdResult, clientSecretResult] = await Promise.all([
      ssmClient.send(new GetParameterCommand({
        Name: clientIdPath,
        WithDecryption: true
      })),
      ssmClient.send(new GetParameterCommand({
        Name: clientSecretPath,
        WithDecryption: true
      }))
    ]);
    
    return {
      clientId: clientIdResult.Parameter.Value,
      clientSecret: clientSecretResult.Parameter.Value
    };
  } catch (error) {
    console.error(`Failed to retrieve credentials for ${siteUrl} from ${clientIdPath}, ${clientSecretPath}:`, error);
    return null;
  }
}

