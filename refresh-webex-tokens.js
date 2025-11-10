#!/usr/bin/env node

import { getTableName } from './lib/dynamodb.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getValidAccessToken } from './lib/webex-token-manager.js';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function refreshWebexTokens() {
  console.log('🔄 Starting Webex Token Refresh...\n');
  
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
      console.log('❌ WebEx Meetings not configured or no sites found');
      return;
    }
    
    console.log(`Found ${config.sites.length} site(s) to refresh tokens for:\n`);
    
    for (let i = 0; i < config.sites.length; i++) {
      const site = config.sites[i];
      console.log(`${i + 1}. Refreshing tokens for: ${site.siteUrl}`);
      
      try {
        const validToken = await getValidAccessToken(site.siteUrl);
        if (validToken) {
          console.log('   ✅ Token refreshed successfully');
          
          // Test the token
          const testResponse = await fetch('https://webexapis.com/v1/people/me', {
            headers: { 'Authorization': `Bearer ${validToken}` }
          });
          
          if (testResponse.ok) {
            const userData = await testResponse.json();
            console.log(`   ✅ Token validated - User: ${userData.displayName} (${userData.emails?.[0]})`);
          } else {
            console.log(`   ❌ Token validation failed: ${testResponse.status}`);
          }
        } else {
          console.log('   ❌ Failed to get valid token');
        }
      } catch (error) {
        console.log(`   ❌ Error refreshing token: ${error.message}`);
      }
      
      console.log('');
    }
    
    console.log('🔄 Token refresh complete!');
    
  } catch (error) {
    console.error('❌ Token refresh failed:', error);
  }
}

// Run the token refresh
refreshWebexTokens();