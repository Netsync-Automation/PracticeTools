import fs from 'fs';
import path from 'path';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

const ENV = process.env.ENVIRONMENT || 'dev';
console.log('SAML Config ENV check:', {
  ENVIRONMENT: process.env.ENVIRONMENT,
  ENV: ENV,
  timestamp: new Date().toISOString()
});
const ssmClient = new SSMClient({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
  credentials: fromNodeProviderChain({
    timeout: 5000,
    maxRetries: 3,
  }),
});

// Get parameter from environment variable first (App Runner injects SSM as env vars), then SSM as fallback
async function getSSMParameter(paramName, envVarName) {
  // First check if environment variable exists and is not empty
  const envValue = process.env[envVarName];
  console.log(`SSM Parameter check: ${paramName}, EnvVar: ${envVarName}, Value length: ${envValue?.length || 0}`);
  if (envValue && envValue.trim() !== '') {
    console.log(`Using environment variable for ${paramName}`);
    return envValue;
  }
  
  // Fallback to SSM if environment variable is empty or missing
  try {
    const ssmParamName = ENV === 'prod' ? `/PracticeTools/${paramName}` : `/PracticeTools/${ENV}/${paramName}`;
    console.log(`Fetching SSM parameter: ${ssmParamName}`);
    const command = new GetParameterCommand({
      Name: ssmParamName,
      WithDecryption: true
    });
    const result = await ssmClient.send(command);
    console.log(`SSM parameter ${ssmParamName} length: ${result.Parameter?.Value?.length || 0}`);
    return result.Parameter?.Value || '';
  } catch (error) {
    console.log(`SSM parameter ${paramName} error: ${error.message}`);
    return '';
  }
}

// Dynamic base URL from SSM parameters
function getBaseUrl() {
  return process.env.NEXTAUTH_URL || 'http://localhost:3000';
}

// Load SP certificate from SSM parameter
async function loadSPCertificate() {
  return await getSSMParameter('DUO_CERT_FILE', 'DUO_CERT_FILE');
}

// Parse IDP configuration from metadata XML
async function parseIDPFromMetadata() {
  const metadata = await getSSMParameter('DUO_METADATA_FILE', 'DUO_METADATA_FILE');
  console.log('SAML Metadata parsing:');
  console.log('- Metadata exists:', !!metadata);
  console.log('- Metadata length:', metadata.length);
  
  if (!metadata || metadata.length < 100) {
    console.log('- No valid metadata found, returning empty config');
    return {
      sso_login_url: '',
      sso_logout_url: '',
      certificates: ['']
    };
  }
  
  // Basic XML parsing for SSO URLs and certificate
  try {
    console.log('- Parsing metadata XML...');
    
    // More specific patterns for Duo SSO URLs
    const ssoMatch = metadata.match(/<md:SingleSignOnService[^>]*Location="([^"]*)"/i);
    const sloMatch = metadata.match(/<md:SingleLogoutService[^>]*Location="([^"]*)"/i);
    const certMatch = metadata.match(/<ds:X509Certificate>([^<]+)<\/ds:X509Certificate>/i);
    
    console.log('- SSO URL:', ssoMatch ? ssoMatch[1] : 'NOT FOUND');
    console.log('- SLO URL:', sloMatch ? sloMatch[1] : 'NOT FOUND');
    console.log('- Certificate:', certMatch ? 'FOUND' : 'NOT FOUND');
    
    return {
      sso_login_url: ssoMatch ? ssoMatch[1] : '',
      sso_logout_url: sloMatch ? sloMatch[1] : '',
      certificates: [certMatch ? certMatch[1] : '']
    };
  } catch (error) {
    console.error('- Metadata parsing error:', error);
    return {
      sso_login_url: '',
      sso_logout_url: '',
      certificates: ['']
    };
  }
}

// Create SAML config asynchronously
export async function createSAMLConfig() {
  console.log('=== SAML Config Creation Started ===');
  const baseUrl = getBaseUrl();
  console.log('Base URL:', baseUrl);
  const spCertificate = await loadSPCertificate();
  console.log('SP Certificate length:', spCertificate?.length || 0);
  const idpConfig = await parseIDPFromMetadata();
  console.log('IDP Config:', { sso_login_url: idpConfig.sso_login_url, certificates_count: idpConfig.certificates?.length });
  const entityId = await getSSMParameter('DUO_ENTITY_ID', 'DUO_ENTITY_ID') || `${baseUrl}/api/auth/saml/metadata`;
  const acsUrl = await getSSMParameter('DUO_ACS', 'DUO_ACS') || `${baseUrl}/api/auth/saml/acs`;
  console.log('Entity ID:', entityId);
  console.log('ACS URL:', acsUrl);

  const config = {
    sp: {
      entity_id: entityId,
      assert_endpoint: acsUrl,
      force_authn: false,
      nameid_format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      sign_get_request: false,
      allow_unencrypted_assertion: true,
      certificate: spCertificate
    },
    idp: idpConfig
  };
  console.log('=== Final SAML Config ===', JSON.stringify(config, null, 2));
  return config;
}

// Legacy export for backward compatibility (will be empty until async load)
export const samlConfig = {
  sp: {
    entity_id: '',
    assert_endpoint: '',
    force_authn: false,
    nameid_format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    sign_get_request: false,
    allow_unencrypted_assertion: true,
    certificate: ''
  },
  idp: {
    sso_login_url: '',
    sso_logout_url: '',
    certificates: ['']
  }
};