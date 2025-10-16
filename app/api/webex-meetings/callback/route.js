import { NextResponse } from 'next/server';
import { SSMClient, GetParameterCommand, PutParameterCommand } from '@aws-sdk/client-ssm';
import { getEnvironment } from '../../../../lib/dynamodb';

export const dynamic = 'force-dynamic';

const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

async function getSSMParameter(name) {
  try {
    const command = new GetParameterCommand({
      Name: name,
      WithDecryption: true
    });
    const response = await ssmClient.send(command);
    return response.Parameter?.Value;
  } catch (error) {
    return null;
  }
}

async function putSSMParameter(name, value) {
  try {
    const command = new PutParameterCommand({
      Name: name,
      Value: value,
      Type: 'String',
      Overwrite: true
    });
    await ssmClient.send(command);
    return true;
  } catch (error) {
    return false;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    
    // Get NEXTAUTH_URL for consistent redirect
    const env = getEnvironment();
    const prefix = env === 'prod' ? '/PracticeTools' : `/PracticeTools/${env}`;
    const nextAuthUrl = await getSSMParameter(`${prefix}/NEXTAUTH_URL`);
    const baseUrl = nextAuthUrl || new URL(request.url).origin.replace('http://', 'https://');
    
    if (error) {
      return NextResponse.redirect(new URL('/admin/settings?tab=company-edu&error=oauth_denied', baseUrl));
    }
    
    if (!code) {
      return NextResponse.redirect(new URL('/admin/settings?tab=company-edu&error=no_code', baseUrl));
    }
    
    const [clientId, clientSecret] = await Promise.all([
      getSSMParameter(`${prefix}/WEBEX_MEETINGS_CLIENT_ID`),
      getSSMParameter(`${prefix}/WEBEX_MEETINGS_CLIENT_SECRET`)
    ]);
    
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(new URL('/admin/settings?tab=company-edu&error=missing_config', baseUrl));
    }
    
    // Get NEXTAUTH_URL for consistent redirect URI
    const nextAuthUrl = await getSSMParameter(`${prefix}/NEXTAUTH_URL`);
    const baseUrl = nextAuthUrl || new URL(request.url).origin.replace('http://', 'https://');
    
    // Exchange code for access token
    const tokenResponse = await fetch('https://webexapis.com/v1/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: `${baseUrl}/api/webex-meetings/callback`
      })
    });
    
    if (!tokenResponse.ok) {
      return NextResponse.redirect(new URL('/admin/settings?tab=company-edu&error=token_exchange_failed', baseUrl));
    }
    
    const tokenData = await tokenResponse.json();
    
    // Store tokens in SSM
    await Promise.all([
      putSSMParameter(`${prefix}/WEBEX_MEETINGS_ACCESS_TOKEN`, tokenData.access_token),
      putSSMParameter(`${prefix}/WEBEX_MEETINGS_REFRESH_TOKEN`, tokenData.refresh_token)
    ]);
    
    return NextResponse.redirect(new URL('/admin/settings?tab=company-edu&success=oauth_complete', baseUrl));
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(new URL('/admin/settings?tab=company-edu&error=callback_error', baseUrl));
  }
}