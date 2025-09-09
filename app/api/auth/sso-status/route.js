import { NextResponse } from 'next/server';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

export const dynamic = 'force-dynamic';

const ssmClient = new SSMClient({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
  credentials: fromNodeProviderChain({
    timeout: 5000,
    maxRetries: 3,
  }),
});

export async function GET() {
  try {
    // Use same environment detection as working version API
    const environment = process.env.ENVIRONMENT || 'dev';
    
    // Use same SSM parameter path as working SSO settings (always /PracticeTools/SSO_ENABLED for prod)
    const paramName = '/PracticeTools/SSO_ENABLED';
    
    try {
      const command = new GetParameterCommand({
        Name: paramName,
        WithDecryption: true
      });
      const result = await ssmClient.send(command);
      const ssoEnabled = result.Parameter?.Value === 'true';
      return NextResponse.json({ enabled: ssoEnabled });
    } catch (ssmError) {
      // If SSM parameter doesn't exist, fall back to environment variable
      const ssoEnabled = process.env.SSO_ENABLED === 'true';
      return NextResponse.json({ enabled: ssoEnabled });
    }
  } catch (error) {
    return NextResponse.json({ enabled: false });
  }
}