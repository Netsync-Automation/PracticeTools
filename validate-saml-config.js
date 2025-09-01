#!/usr/bin/env node

// Validate SAML configuration uses new SSM parameters
import { samlConfig } from './lib/saml-config.js';

console.log('🔍 SAML Configuration Validation\n');

console.log('📊 Environment Variables:');
console.log(`- ENVIRONMENT: ${process.env.ENVIRONMENT || 'not set'}`);
console.log(`- NEXTAUTH_URL: ${process.env.NEXTAUTH_URL || 'not set'}`);
console.log(`- SSO_ENABLED: ${process.env.SSO_ENABLED || 'not set'}`);
console.log(`- DUO_ENTITY_ID: ${process.env.DUO_ENTITY_ID ? 'SET' : 'not set'}`);
console.log(`- DUO_ACS: ${process.env.DUO_ACS ? 'SET' : 'not set'}`);
console.log(`- DUO_METADATA_FILE: ${process.env.DUO_METADATA_FILE ? 'SET' : 'not set'}`);
console.log(`- DUO_CERT_FILE: ${process.env.DUO_CERT_FILE ? 'SET' : 'not set'}`);

console.log('\n🔧 SAML Configuration:');
console.log(`- SP Entity ID: ${samlConfig.sp.entity_id}`);
console.log(`- SP ACS Endpoint: ${samlConfig.sp.assert_endpoint}`);
console.log(`- SP Certificate: ${samlConfig.sp.certificate ? 'Present' : 'Missing'}`);
console.log(`- IDP SSO URL: ${samlConfig.idp.sso_login_url || 'Not configured'}`);
console.log(`- IDP SLO URL: ${samlConfig.idp.sso_logout_url || 'Not configured'}`);
console.log(`- IDP Certificate: ${samlConfig.idp.certificates?.[0] ? 'Present' : 'Missing'}`);

console.log('\n✅ SSM Parameter Usage Validation:');

// Check if using SSM parameters correctly
const issues = [];

if (!process.env.NEXTAUTH_URL) {
  issues.push('❌ NEXTAUTH_URL not set - URLs will default to localhost');
}

if (!process.env.DUO_ENTITY_ID) {
  issues.push('⚠️  DUO_ENTITY_ID not set - using generated URL');
} else {
  console.log('✅ DUO_ENTITY_ID from SSM parameter');
}

if (!process.env.DUO_CERT_FILE) {
  issues.push('❌ DUO_CERT_FILE not set - SP certificate missing');
} else {
  console.log('✅ DUO_CERT_FILE from SSM parameter');
}

if (!process.env.DUO_METADATA_FILE) {
  issues.push('❌ DUO_METADATA_FILE not set - IDP config missing');
} else {
  console.log('✅ DUO_METADATA_FILE from SSM parameter');
}

if (process.env.SSO_ENABLED !== 'true') {
  issues.push('⚠️  SSO_ENABLED is not true - SAML disabled');
} else {
  console.log('✅ SSO_ENABLED from SSM parameter');
}

// Check for hardcoded values
if (samlConfig.sp.entity_id.includes('issuestracker.netsync.com')) {
  issues.push('❌ Hardcoded production URL found in entity_id');
}

if (samlConfig.sp.assert_endpoint.includes('issuestracker.netsync.com')) {
  issues.push('❌ Hardcoded production URL found in assert_endpoint');
}

console.log('\n📋 Validation Results:');
if (issues.length === 0) {
  console.log('🎉 All SAML configuration is using SSM parameters correctly!');
} else {
  console.log('⚠️  Issues found:');
  issues.forEach(issue => console.log(`   ${issue}`));
}

console.log('\n🔗 Configuration Sources:');
console.log('- Base URL: NEXTAUTH_URL SSM parameter');
console.log('- Entity ID: DUO_ENTITY_ID SSM parameter (or generated from base URL)');
console.log('- ACS Endpoint: Generated from base URL');
console.log('- SP Certificate: DUO_CERT_FILE SSM parameter');
console.log('- IDP Config: Parsed from DUO_METADATA_FILE SSM parameter');
console.log('- SSO Status: SSO_ENABLED SSM parameter');