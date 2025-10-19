import { NextResponse } from 'next/server';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { getEnvironment } from '../../../../lib/dynamodb';

export const dynamic = 'force-dynamic';

const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

// Function to validate token scopes by testing all required APIs
async function validateTokenScopes(accessToken) {
  const scopeTests = [
    { name: 'spark:people_read', url: 'https://webexapis.com/v1/people/me' },
    { name: 'spark:recordings_read', url: 'https://webexapis.com/v1/recordings?max=1' },
    { name: 'meeting:recordings_read', url: 'https://webexapis.com/v1/recordings?max=1' },
    { name: 'meeting:transcripts_read', url: 'https://webexapis.com/v1/meetingTranscripts?max=1' },
    { name: 'meeting:admin_transcripts_read', url: 'https://webexapis.com/v1/admin/meetingTranscripts?max=1' }
  ];
  
  const results = { valid: true, hasRequiredScopes: true, scopeResults: [], missingScopes: [] };
  
  for (const test of scopeTests) {
    try {
      const response = await fetch(test.url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      const scopeResult = {
        scope: test.name,
        status: response.status,
        success: response.ok
      };
      
      if (response.status === 401) {
        results.valid = false;
        scopeResult.error = 'Token expired or invalid';
      } else if (response.status === 403) {
        results.hasRequiredScopes = false;
        results.missingScopes.push(test.name);
        scopeResult.error = 'Missing required scope or insufficient permissions';
      } else if (!response.ok) {
        scopeResult.error = `API returned ${response.status}`;
      }
      
      results.scopeResults.push(scopeResult);
    } catch (error) {
      results.valid = false;
      results.scopeResults.push({
        scope: test.name,
        status: 'error',
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}

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
    
    const [clientId, clientSecret, nextAuthUrl, accessToken] = await Promise.all([
      getSSMParameter(`${prefix}/WEBEX_MEETINGS_CLIENT_ID`),
      getSSMParameter(`${prefix}/WEBEX_MEETINGS_CLIENT_SECRET`),
      getSSMParameter(`${prefix}/NEXTAUTH_URL`),
      getSSMParameter(`${prefix}/WEBEX_MEETINGS_ACCESS_TOKEN`)
    ]);
    
    const baseUrl = nextAuthUrl || new URL(request.url).origin.replace('http://', 'https://');
    const redirectUri = `${baseUrl}/api/webex-meetings/callback`;
    const scopes = 'spark:recordings_read meeting:recordings_read meeting:transcripts_read meeting:admin_transcripts_read spark:people_read';
    
    const validation = {
      environment: env,
      baseUrl,
      redirectUri,
      scopes,
      clientIdPresent: !!clientId,
      clientSecretPresent: !!clientSecret,
      clientIdLength: clientId ? clientId.length : 0,
      accessTokenPresent: !!accessToken,
      issues: []
    };
    
    // Validate actual token scopes if token exists
    if (accessToken) {
      const tokenValidation = await validateTokenScopes(accessToken);
      validation.tokenValidation = tokenValidation;
      
      if (!tokenValidation.valid) {
        validation.issues.push('Access token is invalid or expired');
      } else if (!tokenValidation.hasRequiredScopes) {
        const missingScopes = tokenValidation.missingScopes.join(', ');
        validation.issues.push(`Access token missing required scopes: ${missingScopes}`);
        validation.allowReauthorization = true;
      }
    } else {
      validation.issues.push('No access token found - need to authorize Webex first');
    }
    
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
    
    if (!accessToken) {
      validation.issues.push('Access token not found in SSM');
    }
    
    // Test OAuth URL construction
    if (clientId) {
      validation.oauthUrl = `https://webexapis.com/v1/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&prompt=consent`;
    }
    
    return NextResponse.json(validation);
  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json({ error: 'Validation failed' }, { status: 500 });
  }
}