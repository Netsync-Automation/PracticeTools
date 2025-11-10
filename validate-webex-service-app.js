#!/usr/bin/env node

import { getTableName } from './lib/dynamodb.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getWebexTokens } from './lib/ssm.js';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

function isJWT(token) {
  return token && typeof token === 'string' && token.split('.').length === 3;
}

function decodeJWT(token) {
  if (!isJWT(token)) return null;
  try {
    const parts = token.split('.');
    const payload = parts[1];
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
    return decoded;
  } catch (error) {
    return null;
  }
}

async function validateServiceApp() {
  console.log('🔍 Validating Webex Service App Configuration...\n');
  
  try {
    // Get WebEx Meetings configuration
    const tableName = getTableName('Settings');
    const command = new GetCommand({
      TableName: tableName,
      Key: { setting_key: 'webex-meetings' }
    });
    
    const result = await docClient.send(command);
    const config = result.Item?.setting_value ? JSON.parse(result.Item.setting_value) : null;
    
    if (!config?.enabled || !config.sites?.length) {
      console.log('❌ WebEx Meetings not configured');
      return;
    }
    
    for (const site of config.sites) {
      console.log(`\n📍 Analyzing site: ${site.siteUrl}`);
      
      const tokens = await getWebexTokens(site.siteUrl);
      if (!tokens) {
        console.log('   ❌ No tokens found in SSM');
        continue;
      }
      
      // Analyze access token
      console.log('   🔑 Access Token Analysis:');
      console.log(`      Length: ${tokens.accessToken.length} characters`);
      console.log(`      Is JWT: ${isJWT(tokens.accessToken) ? 'Yes' : 'No'}`);
      
      if (isJWT(tokens.accessToken)) {
        const decoded = decodeJWT(tokens.accessToken);
        if (decoded) {
          console.log(`      Issuer: ${decoded.iss || 'N/A'}`);
          console.log(`      Subject: ${decoded.sub || 'N/A'}`);
          console.log(`      Audience: ${decoded.aud || 'N/A'}`);
          if (decoded.exp) {
            const expiry = new Date(decoded.exp * 1000);
            console.log(`      Expires: ${expiry.toISOString()}`);
            console.log(`      Expired: ${expiry < new Date() ? 'Yes' : 'No'}`);
          }
        }
      } else {
        console.log('      Type: Bearer token (not JWT)');
        console.log('      Likely: Service app long-lived token');
      }
      
      // Test access token
      console.log('   🧪 Testing Access Token:');
      try {
        const testResponse = await fetch('https://webexapis.com/v1/people/me', {
          headers: { 'Authorization': `Bearer ${tokens.accessToken}` }
        });
        
        if (testResponse.ok) {
          const userData = await testResponse.json();
          console.log(`      ✅ Valid - User: ${userData.displayName}`);
          console.log(`      Email: ${userData.emails?.[0] || 'N/A'}`);
          console.log(`      Type: ${userData.type || 'N/A'}`);
        } else {
          console.log(`      ❌ Invalid - Status: ${testResponse.status}`);
          if (testResponse.status === 401) {
            console.log('      Reason: Token expired or invalid');
          }
        }
      } catch (error) {
        console.log(`      ❌ Error testing token: ${error.message}`);
      }
      
      // Analyze refresh token
      console.log('   🔄 Refresh Token Analysis:');
      console.log(`      Length: ${tokens.refreshToken.length} characters`);
      console.log(`      Is JWT: ${isJWT(tokens.refreshToken) ? 'Yes' : 'No'}`);
      console.log(`      Same as access: ${tokens.accessToken === tokens.refreshToken ? 'Yes' : 'No'}`);
      
      if (tokens.accessToken === tokens.refreshToken) {
        console.log('      ⚠️  Access and refresh tokens are identical');
        console.log('      This is common for service apps with long-lived tokens');
      }
      
      // Test if refresh token works as access token
      if (tokens.accessToken !== tokens.refreshToken) {
        console.log('   🧪 Testing Refresh Token as Access Token:');
        try {
          const testResponse = await fetch('https://webexapis.com/v1/people/me', {
            headers: { 'Authorization': `Bearer ${tokens.refreshToken}` }
          });
          
          if (testResponse.ok) {
            console.log('      ✅ Refresh token also works as access token');
            console.log('      This suggests it\'s a long-lived service app token');
          } else {
            console.log('      ❌ Refresh token does not work as access token');
            console.log('      This suggests separate access/refresh token flow');
          }
        } catch (error) {
          console.log(`      ❌ Error testing refresh token: ${error.message}`);
        }
      }
    }
    
    console.log('\n📋 Service App Validation Summary:');
    console.log('- Service apps typically use long-lived bearer tokens');
    console.log('- These tokens may not need refresh, or refresh differently');
    console.log('- If access and refresh tokens are the same, no refresh is needed');
    console.log('- If tokens are different, standard OAuth refresh flow may work');
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
  }
}

// Run the validation
validateServiceApp();