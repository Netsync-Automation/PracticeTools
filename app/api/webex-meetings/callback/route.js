import { NextResponse } from 'next/server';
import { SSMClient, GetParameterCommand, PutParameterCommand } from '@aws-sdk/client-ssm';
import { getEnvironment } from '../../../../lib/dynamodb';

export const dynamic = 'force-dynamic';

const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

async function getSSMParameter(name) {
  try {
    console.log(`[OAUTH] Retrieving SSM parameter: ${name}`);
    const command = new GetParameterCommand({
      Name: name,
      WithDecryption: true
    });
    const response = await ssmClient.send(command);
    const value = response.Parameter?.Value;
    console.log(`[OAUTH] SSM parameter ${name}: ${value ? 'found' : 'not found'}`);
    return value;
  } catch (error) {
    console.log(`[OAUTH] SSM parameter ${name} error: ${error.message}`);
    return null;
  }
}

async function putSSMParameter(name, value) {
  try {
    console.log(`[OAUTH] Storing SSM parameter: ${name}`);
    const command = new PutParameterCommand({
      Name: name,
      Value: value,
      Type: 'String',
      Overwrite: true
    });
    await ssmClient.send(command);
    console.log(`[OAUTH] SSM parameter ${name}: stored successfully`);
    return true;
  } catch (error) {
    console.log(`[OAUTH] SSM parameter ${name} storage error: ${error.message}`);
    return false;
  }
}

export async function GET(request) {
  try {
    console.log('[OAUTH] OAuth callback received');
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');
    
    console.log(`[OAUTH] Callback parameters - Code: ${code ? 'present' : 'missing'}, Error: ${error || 'none'}, State: ${state || 'none'}`);
    
    // Get environment and base URL
    const env = getEnvironment();
    const prefix = env === 'prod' ? '/PracticeTools' : `/PracticeTools/${env}`;
    console.log(`[OAUTH] Environment: ${env}, SSM prefix: ${prefix}`);
    
    const nextAuthUrl = await getSSMParameter(`${prefix}/NEXTAUTH_URL`);
    const baseUrl = nextAuthUrl || new URL(request.url).origin.replace('http://', 'https://');
    console.log(`[OAUTH] Base URL: ${baseUrl}`);
    
    if (error) {
      console.log(`[OAUTH] OAuth error received: ${error}`);
      return NextResponse.redirect(new URL('/admin/settings?tab=company-edu&error=oauth_denied', baseUrl));
    }
    
    if (!code) {
      console.log('[OAUTH] No authorization code received');
      return NextResponse.redirect(new URL('/admin/settings?tab=company-edu&error=no_code', baseUrl));
    }
    
    const [clientId, clientSecret] = await Promise.all([
      getSSMParameter(`${prefix}/WEBEX_MEETINGS_CLIENT_ID`),
      getSSMParameter(`${prefix}/WEBEX_MEETINGS_CLIENT_SECRET`)
    ]);
    
    console.log(`[OAUTH] Retrieved credentials - ClientID: ${clientId ? 'present' : 'missing'} (${clientId?.length || 0} chars), ClientSecret: ${clientSecret ? 'present' : 'missing'} (${clientSecret?.length || 0} chars)`);
    
    if (!clientId || !clientSecret) {
      console.log('[OAUTH] Missing client credentials in SSM');
      return NextResponse.redirect(new URL('/admin/settings?tab=company-edu&error=missing_config', baseUrl));
    }
    
    // Exchange code for access token
    const redirectUri = `${baseUrl}/api/webex-meetings/callback`;
    const tokenRequestBody = {
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri
    };
    
    console.log(`[OAUTH] Exchanging authorization code for access token`);
    console.log(`[OAUTH] Token request - RedirectURI: ${redirectUri}`);
    console.log(`[OAUTH] Token request body (without secrets):`, {
      grant_type: tokenRequestBody.grant_type,
      client_id: clientId ? `${clientId.substring(0, 10)}...` : 'missing',
      client_secret: clientSecret ? `${clientSecret.substring(0, 10)}...` : 'missing',
      code: code ? `${code.substring(0, 10)}...` : 'missing',
      redirect_uri: tokenRequestBody.redirect_uri
    });
    
    const tokenResponse = await fetch('https://webexapis.com/v1/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(tokenRequestBody)
    });
    
    console.log(`[OAUTH] Token exchange response: HTTP ${tokenResponse.status}`);
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.log(`[OAUTH] Token exchange failed: ${errorText}`);
      return NextResponse.redirect(new URL('/admin/settings?tab=company-edu&error=token_exchange_failed', baseUrl));
    }
    
    const tokenData = await tokenResponse.json();
    console.log(`[OAUTH] Token exchange successful - AccessToken: ${tokenData.access_token ? 'received' : 'missing'}, RefreshToken: ${tokenData.refresh_token ? 'received' : 'missing'}, Scope: ${tokenData.scope || 'not provided'}`);
    
    // Store tokens in SSM
    console.log('[OAUTH] Storing tokens in SSM...');
    const [accessTokenStored, refreshTokenStored] = await Promise.all([
      putSSMParameter(`${prefix}/WEBEX_MEETINGS_ACCESS_TOKEN`, tokenData.access_token),
      putSSMParameter(`${prefix}/WEBEX_MEETINGS_REFRESH_TOKEN`, tokenData.refresh_token)
    ]);
    
    console.log(`[OAUTH] Token storage results - AccessToken: ${accessTokenStored ? 'stored' : 'failed'}, RefreshToken: ${refreshTokenStored ? 'stored' : 'failed'}`);
    
    if (tokenData.scope) {
      console.log(`[OAUTH] Granted scopes from Webex: ${tokenData.scope}`);
      const requiredScopes = ['spark:recordings_read', 'meeting:recordings_read', 'meeting:transcripts_read', 'meeting:admin_transcripts_read', 'spark:people_read'];
      const grantedScopes = tokenData.scope.split(' ');
      const missingScopes = requiredScopes.filter(scope => !grantedScopes.includes(scope));
      
      if (missingScopes.length > 0) {
        console.log(`[OAUTH] WARNING: Missing required scopes: ${missingScopes.join(', ')}`);
      } else {
        console.log('[OAUTH] All required scopes were granted');
      }
    } else {
      console.log('[OAUTH] WARNING: No scope information returned from Webex');
    }
    
    console.log('[OAUTH] OAuth flow completed successfully');
    return NextResponse.redirect(new URL('/admin/settings?tab=company-edu&success=oauth_complete', baseUrl));
    
  } catch (error) {
    console.error('[OAUTH] OAuth callback error:', error);
    return NextResponse.redirect(new URL('/admin/settings?tab=company-edu&error=callback_error', baseUrl));
  }
}