import { NextResponse } from 'next/server';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
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

export async function GET(request) {
  try {
    const env = getEnvironment();
    const prefix = env === 'prod' ? '/PracticeTools' : `/PracticeTools/${env}`;
    
    const [clientId, clientSecret, nextAuthUrl] = await Promise.all([
      getSSMParameter(`${prefix}/WEBEX_MEETINGS_CLIENT_ID`),
      getSSMParameter(`${prefix}/WEBEX_MEETINGS_CLIENT_SECRET`),
      getSSMParameter(`${prefix}/NEXTAUTH_URL`)
    ]);
    
    const baseUrl = nextAuthUrl || new URL(request.url).origin.replace('http://', 'https://');
    const redirectUri = `${baseUrl}/api/webex-meetings/callback`;
    const scopes = 'spark:recordings_read meeting:recordings_read meeting:transcripts_read';
    
    const validation = {
      environment: env,
      baseUrl,
      redirectUri,
      scopes,
      clientIdPresent: !!clientId,
      clientSecretPresent: !!clientSecret,
      clientIdLength: clientId ? clientId.length : 0,
      issues: []
    };
    
    // Check for common issues
    if (!clientId) {
      validation.issues.push('Client ID is missing from SSM');
    } else if (clientId.length < 10) {
      validation.issues.push('Client ID appears too short (should be 64+ characters)');
    }
    
    if (!clientSecret) {
      validation.issues.push('Client Secret is missing from SSM');
    } else if (clientSecret.length < 10) {
      validation.issues.push('Client Secret appears too short (should be 64+ characters)');
    }
    
    if (!baseUrl.startsWith('https://')) {
      validation.issues.push('Base URL must use HTTPS for OAuth');
    }
    
    // Test OAuth URL construction
    if (clientId) {
      validation.oauthUrl = `https://webexapis.com/v1/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
    }
    
    return NextResponse.json(validation);
  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json({ error: 'Validation failed' }, { status: 500 });
  }
}