#!/usr/bin/env node

/**
 * Token Manager Test Utility
 * Tests access token validation and refresh token flow with client credentials
 */

import { getValidAccessToken, refreshAllTokens } from './lib/webex-token-manager.js';
import { getWebexTokens, getWebexCredentials } from './lib/ssm.js';
import { getTableName } from './lib/dynamodb.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Decode JWT token to inspect payload
 */
function decodeJWT(token) {
  if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
    return null;
  }
  
  try {
    const parts = token.split('.');
    const payload = parts[1];
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Test token validity with Webex API
 */
async function testTokenValidity(token, siteUrl) {
  try {
    const response = await fetch('https://webexapis.com/v1/people/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      const userData = await response.json();
      return {
        valid: true,
        status: response.status,
        userInfo: {
          id: userData.id,
          emails: userData.emails,
          displayName: userData.displayName,
          orgId: userData.orgId
        }
      };
    } else {
      return {
        valid: false,
        status: response.status,
        error: response.statusText
      };
    }
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}

/**
 * Get configured sites from settings
 */
async function getConfiguredSites() {
  const tableName = getTableName('Settings');
  const command = new GetCommand({
    TableName: tableName,
    Key: { setting_key: 'webex-meetings' }
  });
  
  const result = await docClient.send(command);
  const config = result.Item?.setting_value ? JSON.parse(result.Item.setting_value) : null;
  
  return config?.sites || [];
}

/**
 * Test refresh token flow
 */
async function testRefreshFlow(siteUrl, refreshToken) {
  console.log(`\n🔄 Testing refresh token flow for ${siteUrl}...`);
  
  try {
    const credentials = await getWebexCredentials(siteUrl);
    
    if (!credentials?.clientId || !credentials?.clientSecret) {
      console.log('❌ Missing client credentials');
      return { success: false, error: 'Missing client credentials' };
    }
    
    console.log(`   Client ID: ${credentials.clientId.substring(0, 8)}...`);
    console.log(`   Client Secret: ${credentials.clientSecret ? '[CONFIGURED]' : '[MISSING]'}`);
    
    const response = await fetch('https://webexapis.com/v1/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Refresh successful');
      console.log(`   New access token: ${data.access_token.substring(0, 20)}...`);
      console.log(`   Token type: ${data.token_type}`);
      console.log(`   Expires in: ${data.expires_in} seconds`);
      
      return {
        success: true,
        newAccessToken: data.access_token,
        newRefreshToken: data.refresh_token,
        expiresIn: data.expires_in
      };
    } else {
      const error = await response.text();
      console.log(`❌ Refresh failed: ${response.status} ${response.statusText}`);
      console.log(`   Error: ${error}`);
      
      return {
        success: false,
        status: response.status,
        error: error
      };
    }
  } catch (error) {
    console.log(`❌ Refresh error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testTokenManager() {
  console.log('🔐 Testing Webex Token Manager with Client Credentials');
  console.log('=' .repeat(65));
  
  try {
    // Get configured sites
    console.log('\n📋 Loading configured sites...');
    const sites = await getConfiguredSites();
    
    if (!sites.length) {
      console.log('❌ No sites configured');
      return;
    }
    
    console.log(`✅ Found ${sites.length} configured site(s)`);
    
    for (const site of sites) {
      console.log(`\n🌐 Testing site: ${site.siteName || site.siteUrl}`);
      console.log('-'.repeat(50));
      
      // Test 1: Load tokens from SSM
      console.log('\n📥 Step 1: Loading tokens from SSM...');
      const tokens = await getWebexTokens(site.siteUrl);
      
      if (!tokens) {
        console.log('❌ No tokens found in SSM');
        continue;
      }
      
      console.log('✅ Tokens loaded from SSM');
      console.log(`   Access Token: ${tokens.accessToken.substring(0, 20)}...`);
      console.log(`   Refresh Token: ${tokens.refreshToken.substring(0, 20)}...`);
      
      // Decode JWT if possible
      const decoded = decodeJWT(tokens.accessToken);
      if (decoded) {
        const expiry = new Date(decoded.exp * 1000);
        const timeUntilExpiry = expiry.getTime() - Date.now();
        console.log(`   Token expires: ${expiry.toISOString()}`);
        console.log(`   Time until expiry: ${Math.round(timeUntilExpiry / 1000 / 60)} minutes`);
        console.log(`   Issued by: ${decoded.iss}`);
        console.log(`   Subject: ${decoded.sub}`);
      }
      
      // Test 2: Validate current access token
      console.log('\n🔍 Step 2: Testing current access token...');
      const tokenTest = await testTokenValidity(tokens.accessToken, site.siteUrl);
      
      if (tokenTest.valid) {
        console.log('✅ Access token is valid');
        console.log(`   User: ${tokenTest.userInfo.displayName}`);
        console.log(`   Org ID: ${tokenTest.userInfo.orgId}`);
        console.log(`   Emails: ${tokenTest.userInfo.emails.join(', ')}`);
      } else {
        console.log(`❌ Access token invalid: ${tokenTest.status} ${tokenTest.error}`);
      }
      
      // Test 3: Test client credentials
      console.log('\n🔑 Step 3: Checking client credentials...');
      const credentials = await getWebexCredentials(site.siteUrl);
      
      if (credentials?.clientId && credentials?.clientSecret) {
        console.log('✅ Client credentials configured');
        console.log(`   Client ID: ${credentials.clientId}`);
        console.log(`   Client Secret: [CONFIGURED]`);
      } else {
        console.log('❌ Client credentials missing');
        console.log(`   Client ID: ${credentials?.clientId || '[MISSING]'}`);
        console.log(`   Client Secret: ${credentials?.clientSecret ? '[CONFIGURED]' : '[MISSING]'}`);
      }
      
      // Test 4: Test refresh token flow
      if (credentials?.clientId && credentials?.clientSecret) {
        const refreshResult = await testRefreshFlow(site.siteUrl, tokens.refreshToken);
        
        if (refreshResult.success) {
          // Test the new token
          console.log('\n🧪 Step 4: Testing refreshed token...');
          const newTokenTest = await testTokenValidity(refreshResult.newAccessToken, site.siteUrl);
          
          if (newTokenTest.valid) {
            console.log('✅ Refreshed token is valid');
            console.log(`   User: ${newTokenTest.userInfo.displayName}`);
          } else {
            console.log('❌ Refreshed token is invalid');
          }
        }
      }
      
      // Test 5: Test token manager function
      console.log('\n⚙️  Step 5: Testing getValidAccessToken function...');
      try {
        const validToken = await getValidAccessToken(site.siteUrl);
        console.log('✅ getValidAccessToken succeeded');
        console.log(`   Returned token: ${validToken.substring(0, 20)}...`);
        
        // Test the returned token
        const finalTest = await testTokenValidity(validToken, site.siteUrl);
        if (finalTest.valid) {
          console.log('✅ Token manager returned valid token');
        } else {
          console.log('❌ Token manager returned invalid token');
        }
      } catch (error) {
        console.log(`❌ getValidAccessToken failed: ${error.message}`);
      }
    }
    
    // Test 6: Test refresh all tokens
    console.log('\n🔄 Step 6: Testing refreshAllTokens function...');
    try {
      await refreshAllTokens(sites);
      console.log('✅ refreshAllTokens completed');
    } catch (error) {
      console.log(`❌ refreshAllTokens failed: ${error.message}`);
    }
    
    console.log('\n🎉 Token manager testing completed!');
    console.log('\n📊 Summary:');
    console.log('   - Check that access tokens are valid');
    console.log('   - Verify client credentials are properly configured');
    console.log('   - Confirm refresh token flow works with client credentials');
    console.log('   - Validate token manager functions return valid tokens');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testTokenManager().catch(console.error);