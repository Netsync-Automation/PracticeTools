import { NextResponse } from 'next/server';
import { validateUserSession } from '../../../../lib/auth-check';
import { createSAMLConfig } from '../../../../lib/saml-config';
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

// Get parameter from SSM
async function getSSMParameter(paramName) {
  try {
    const ssmParamName = ENV === 'prod' ? `/PracticeTools/${paramName}` : `/PracticeTools/${ENV}/${paramName}`;
    const command = new GetParameterCommand({
      Name: ssmParamName,
      WithDecryption: true
    });
    const result = await ssmClient.send(command);
    return result.Parameter?.Value || '';
  } catch (error) {
    return '';
  }
}

export async function GET(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid || !validation.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Load SAML configuration from SSM
    const samlConfig = await createSAMLConfig();
    const ssoEnabled = await getSSMParameter('SSO_ENABLED');
    const duoEntityId = await getSSMParameter('DUO_ENTITY_ID');
    const duoAcs = await getSSMParameter('DUO_ACS');
    const duoMetadata = await getSSMParameter('DUO_METADATA_FILE');
    const duoCert = await getSSMParameter('DUO_CERT_FILE');
    
    // Validate SAML configuration
    const validation_results = {
      environment: ENV,
      sso_enabled: ssoEnabled === 'true',
      base_url: process.env.NEXTAUTH_URL || 'http://localhost:3000',
      
      // Service Provider Configuration
      sp_entity_id: samlConfig.sp.entity_id,
      sp_acs_endpoint: samlConfig.sp.assert_endpoint,
      sp_certificate_present: !!samlConfig.sp.certificate,
      
      // Identity Provider Configuration  
      idp_sso_url: samlConfig.idp.sso_login_url,
      idp_slo_url: samlConfig.idp.sso_logout_url,
      idp_certificate_present: !!(samlConfig.idp.certificates && samlConfig.idp.certificates[0]),
      
      // SSM Parameters Status
      ssm_parameters: {
        SSO_ENABLED: !!ssoEnabled,
        DUO_ENTITY_ID: !!duoEntityId,
        DUO_ACS: !!duoAcs,
        DUO_METADATA_FILE: !!duoMetadata,
        DUO_CERT_FILE: !!duoCert,
        NEXTAUTH_URL: !!process.env.NEXTAUTH_URL
      },
      
      // Configuration Issues
      issues: []
    };
    
    // Check for configuration issues
    if (!validation_results.sso_enabled) {
      validation_results.issues.push('SSO is disabled');
    }
    
    if (!validation_results.sp_entity_id) {
      validation_results.issues.push('SP Entity ID not configured');
    }
    
    if (!validation_results.sp_acs_endpoint) {
      validation_results.issues.push('SP ACS endpoint not configured');
    }
    
    if (!validation_results.idp_sso_url) {
      validation_results.issues.push('IDP SSO URL not configured');
    }
    
    if (!validation_results.idp_certificate_present) {
      validation_results.issues.push('IDP certificate not present');
    }
    
    if (!validation_results.ssm_parameters.NEXTAUTH_URL) {
      validation_results.issues.push('NEXTAUTH_URL not configured');
    }
    
    validation_results.is_valid = validation_results.issues.length === 0 && validation_results.sso_enabled;
    
    return NextResponse.json(validation_results);
  } catch (error) {
    console.error('SAML validation error:', error);
    return NextResponse.json({ 
      error: 'Validation failed', 
      details: error.message 
    }, { status: 500 });
  }
}