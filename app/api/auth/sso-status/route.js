import { NextResponse } from 'next/server';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

const ENV = process.env.ENVIRONMENT || 'prod';
const ssmClient = new SSMClient({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
  credentials: fromNodeProviderChain({
    timeout: 5000,
    maxRetries: 3,
  }),
});

export async function GET() {
  console.log('[SSO-STATUS] API called - ENV:', ENV);
  
  try {
    // Check SSO_ENABLED from SSM parameter
    const paramName = ENV === 'prod' ? '/PracticeTools/SSO_ENABLED' : `/PracticeTools/${ENV}/SSO_ENABLED`;
    console.log('[SSO-STATUS] Checking parameter:', paramName);
    
    try {
      const command = new GetParameterCommand({
        Name: paramName,
        WithDecryption: true
      });
      const result = await ssmClient.send(command);
      const ssoEnabled = result.Parameter?.Value === 'true';
      console.log('[SSO-STATUS] SSM parameter value:', result.Parameter?.Value, '-> enabled:', ssoEnabled);
      return NextResponse.json({ enabled: ssoEnabled });
    } catch (ssmError) {
      console.log('[SSO-STATUS] SSM error, checking env var. Error:', ssmError.message);
      // If SSM parameter doesn't exist, fall back to environment variable
      const ssoEnabled = process.env.SSO_ENABLED === 'true';
      console.log('[SSO-STATUS] Environment variable SSO_ENABLED:', process.env.SSO_ENABLED, '-> enabled:', ssoEnabled);
      return NextResponse.json({ enabled: ssoEnabled });
    }
  } catch (error) {
    console.error('[SSO-STATUS] Error checking SSO status:', error);
    return NextResponse.json({ enabled: false });
  }
}