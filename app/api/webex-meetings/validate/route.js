import { NextResponse } from 'next/server';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { getEnvironment } from '../../../../lib/dynamodb';

export const dynamic = 'force-dynamic';

const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

// Function to validate token scopes by testing all required APIs
async function validateTokenScopes(accessToken) {
  console.log('[OAUTH] Starting scope validation for access token');
  const scopeTests = [
    { name: 'spark:people_read', url: 'https://webexapis.com/v1/people/me' },
    { name: 'spark:recordings_read', url: 'https://webexapis.com/v1/recordings?max=1' },
    { name: 'meeting:recordings_read', url: 'https://webexapis.com/v1/recordings?max=1' },
    { name: 'meeting:transcripts_read', url: 'https://webexapis.com/v1/meetingTranscripts?max=1' },
    { name: 'meeting:admin_transcripts_read', url: 'https://webexapis.com/v1/admin/meetingTranscripts?max=1' }
  ];
  
  const results = { valid: true, hasRequiredScopes: true, scopeResults: [], missingScopes: [] };
  
  for (const test of scopeTests) {
    console.log(`[OAUTH] Testing scope: ${test.name} with URL: ${test.url}`);
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
      
      console.log(`[OAUTH] Scope ${test.name} test result: HTTP ${response.status} (${response.ok ? 'SUCCESS' : 'FAILED'})`);
      
      if (response.status === 401) {
        console.log(`[OAUTH] Scope ${test.name}: Token expired or invalid (401)`);
        results.valid = false;
        scopeResult.error = 'Token expired or invalid';
      } else if (response.status === 403) {
        console.log(`[OAUTH] Scope ${test.name}: Missing required scope or insufficient permissions (403)`);
        results.hasRequiredScopes = false;
        results.missingScopes.push(test.name);
        scopeResult.error = 'Missing required scope or insufficient permissions';
      } else if (!response.ok) {
        console.log(`[OAUTH] Scope ${test.name}: API returned error ${response.status}`);
        scopeResult.error = `API returned ${response.status}`;
      } else {
        console.log(`[OAUTH] Scope ${test.name}: SUCCESS - scope is working`);
      }
      
      results.scopeResults.push(scopeResult);
    } catch (error) {
      console.log(`[OAUTH] Scope ${test.name}: Network/fetch error - ${error.message}`);
      results.valid = false;
      results.scopeResults.push({
        scope: test.name,
        status: 'error',
        success: false,
        error: error.message
      });
    }
  }
  
  console.log(`[OAUTH] Scope validation complete - Valid: ${results.valid}, HasRequiredScopes: ${results.hasRequiredScopes}, MissingScopes: [${results.missingScopes.join(', ')}]`);
  return results;
}

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

export async function GET(request) {
  try {
    console.log('[OAUTH] Starting Webex OAuth validation');
    const env = getEnvironment();
    const prefix = env === 'prod' ? '/PracticeTools' : `/PracticeTools/${env}`;
    console.log(`[OAUTH] Environment: ${env}, SSM prefix: ${prefix}`);
    
    const [clientId, clientSecret, nextAuthUrl, accessToken] = await Promise.all([
      getSSMParameter(`${prefix}/WEBEX_MEETINGS_CLIENT_ID`),
      getSSMParameter(`${prefix}/WEBEX_MEETINGS_CLIENT_SECRET`),
      getSSMParameter(`${prefix}/NEXTAUTH_URL`),
      getSSMParameter(`${prefix}/WEBEX_MEETINGS_ACCESS_TOKEN`)
    ]);
    
    console.log(`[OAUTH] SSM Parameters retrieved - ClientID: ${clientId ? 'present' : 'missing'} (${clientId?.length || 0} chars), ClientSecret: ${clientSecret ? 'present' : 'missing'} (${clientSecret?.length || 0} chars), AccessToken: ${accessToken ? 'present' : 'missing'}`);
    
    const baseUrl = nextAuthUrl || new URL(request.url).origin.replace('http://', 'https://');
    const redirectUri = `${baseUrl}/api/webex-meetings/callback`;
    const scopes = 'spark:recordings_read meeting:recordings_read meeting:transcripts_read meeting:admin_transcripts_read spark:people_read';
    
    console.log(`[OAUTH] OAuth configuration - BaseURL: ${baseUrl}, RedirectURI: ${redirectUri}`);
    console.log(`[OAUTH] Required scopes: ${scopes}`);
    
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
      console.log('[OAUTH] Validating existing access token scopes...');
      const tokenValidation = await validateTokenScopes(accessToken);
      validation.tokenValidation = tokenValidation;
      
      console.log(`[OAUTH] Token validation results - Valid: ${tokenValidation.valid}, HasRequiredScopes: ${tokenValidation.hasRequiredScopes}`);
      console.log(`[OAUTH] Scope test results:`, tokenValidation.scopeResults);
      
      if (!tokenValidation.valid) {
        console.log('[OAUTH] Access token is invalid or expired');
        validation.issues.push('Access token is invalid or expired');
      } else if (!tokenValidation.hasRequiredScopes) {
        const missingScopes = tokenValidation.missingScopes.join(', ');
        console.log(`[OAUTH] Missing scopes detected: ${missingScopes}`);
        validation.issues.push(`Access token missing required scopes: ${missingScopes}`);
        validation.allowReauthorization = true;
      } else {
        console.log('[OAUTH] All required scopes are present and working');
      }
    } else {
      console.log('[OAUTH] No access token found in SSM');
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
      console.log(`[OAUTH] Generated OAuth URL: ${validation.oauthUrl}`);
      
      // Debug OAuth URL scope inclusion
      console.log(`[OAUTH] ===== OAUTH URL SCOPE ANALYSIS =====`);
      const requiredScopes = ['spark:recordings_read', 'meeting:recordings_read', 'meeting:transcripts_read', 'meeting:admin_transcripts_read', 'spark:people_read'];
      requiredScopes.forEach(scope => {
        const encodedScope = encodeURIComponent(scope);
        const inUrl = validation.oauthUrl.includes(encodedScope);
        console.log(`[OAUTH] OAuth URL includes ${scope}: ${inUrl}`);
      });
      console.log(`[OAUTH] OAuth URL includes admin scope (encoded): ${validation.oauthUrl.includes('meeting%3Aadmin_transcripts_read')}`);
      console.log(`[OAUTH] ===== END OAUTH URL ANALYSIS =====`);
    } else {
      console.log('[OAUTH] Cannot generate OAuth URL - missing client ID');
    }
    
    console.log(`[OAUTH] Validation complete - Issues found: ${validation.issues.length}`);
    if (validation.issues.length > 0) {
      console.log('[OAUTH] Issues:', validation.issues);
    }
    
    return NextResponse.json(validation);
  } catch (error) {
    console.error('[OAUTH] Validation error:', error);
    return NextResponse.json({ error: 'Validation failed' }, { status: 500 });
  }
}