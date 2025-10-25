#!/usr/bin/env node

import { getTableName, getEnvironment } from './lib/dynamodb.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getSecureParameter } from './lib/ssm-config.js';
import { getWebexTokens } from './lib/ssm.js';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function diagnoseWebexWebhooks() {
  console.log('🔍 Starting Webex Webhooks Diagnosis...\n');
  
  try {
    // 1. Check WebEx Meetings configuration
    console.log('1. Checking WebEx Meetings Configuration...');
    const tableName = getTableName('Settings');
    const command = new GetCommand({
      TableName: tableName,
      Key: { setting_key: 'webex-meetings' }
    });
    
    const result = await docClient.send(command);
    const config = result.Item?.setting_value ? JSON.parse(result.Item.setting_value) : null;
    
    if (!config) {
      console.log('❌ No WebEx Meetings configuration found');
      return;
    }
    
    console.log('✅ Configuration found:', {
      enabled: config.enabled,
      sitesCount: config.sites?.length || 0
    });
    
    if (!config.enabled) {
      console.log('❌ WebEx Meetings integration is disabled');
      return;
    }
    
    if (!config.sites?.length) {
      console.log('❌ No sites configured');
      return;
    }
    
    // 2. Check NEXTAUTH_URL in SSM
    console.log('\n2. Checking NEXTAUTH_URL in SSM...');
    const env = getEnvironment();
    const nextAuthUrlParam = env === 'prod' ? '/PracticeTools/NEXTAUTH_URL' : '/PracticeTools/dev/NEXTAUTH_URL';
    const nextAuthUrl = await getSecureParameter(nextAuthUrlParam);
    
    if (nextAuthUrl) {
      console.log('✅ NEXTAUTH_URL found in SSM:', nextAuthUrl);
    } else {
      console.log('❌ NEXTAUTH_URL not found in SSM:', nextAuthUrlParam);
      console.log('   Using fallback from environment:', process.env.NEXTAUTH_URL);
    }
    
    const baseUrl = nextAuthUrl || process.env.NEXTAUTH_URL;
    if (!baseUrl) {
      console.log('❌ No base URL available for webhooks');
      return;
    }
    
    // 3. Check each site configuration
    console.log('\n3. Checking Site Configurations...');
    for (let i = 0; i < config.sites.length; i++) {
      const site = config.sites[i];
      console.log(`\n   Site ${i + 1}: ${site.siteUrl}`);
      
      // Check tokens in SSM
      const tokens = await getWebexTokens(site.siteUrl);
      if (tokens?.accessToken) {
        console.log('   ✅ Access token found in SSM');
        
        // Test token validity by making a simple API call
        try {
          const testResponse = await fetch('https://webexapis.com/v1/people/me', {
            headers: { 'Authorization': `Bearer ${tokens.accessToken}` }
          });
          
          if (testResponse.ok) {
            console.log('   ✅ Access token is valid');
          } else {
            console.log('   ❌ Access token is invalid or expired:', testResponse.status);
          }
        } catch (error) {
          console.log('   ❌ Error testing access token:', error.message);
        }
      } else {
        console.log('   ❌ Access token not found in SSM');
      }
      
      if (tokens?.refreshToken) {
        console.log('   ✅ Refresh token found in SSM');
      } else {
        console.log('   ❌ Refresh token not found in SSM');
      }
      
      // Check recording hosts
      if (site.recordingHosts?.length) {
        console.log('   ✅ Recording hosts configured:', site.recordingHosts.length);
      } else {
        console.log('   ❌ No recording hosts configured');
      }
      
      // Check existing webhooks
      if (tokens?.accessToken) {
        try {
          const webhooksResponse = await fetch('https://webexapis.com/v1/webhooks', {
            headers: { 'Authorization': `Bearer ${tokens.accessToken}` }
          });
          
          if (webhooksResponse.ok) {
            const webhooksData = await webhooksResponse.json();
            const allWebhooks = webhooksData.items || [];
            
            const recordingsWebhook = allWebhooks.find(w => 
              w.targetUrl === `${baseUrl}/api/webhooks/webexmeetings/recordings` &&
              w.resource === 'recordings' &&
              (w.siteUrl === site.siteUrl || w.name.includes(site.siteUrl))
            );
            
            const transcriptsWebhook = allWebhooks.find(w => 
              w.targetUrl === `${baseUrl}/api/webhooks/webexmeetings/transcripts` &&
              w.resource === 'meetingTranscripts' &&
              (w.siteUrl === site.siteUrl || w.name.includes(site.siteUrl))
            );
            
            console.log('   📊 Webhook Status:');
            console.log('     Recordings:', recordingsWebhook ? `✅ Active (${recordingsWebhook.status})` : '❌ Missing');
            console.log('     Transcripts:', transcriptsWebhook ? `✅ Active (${transcriptsWebhook.status})` : '❌ Missing');
            
            if (recordingsWebhook) {
              console.log('     Recordings Details:', {
                id: recordingsWebhook.id,
                ownedBy: recordingsWebhook.ownedBy,
                siteUrl: recordingsWebhook.siteUrl,
                filter: recordingsWebhook.filter
              });
            }
            
            if (transcriptsWebhook) {
              console.log('     Transcripts Details:', {
                id: transcriptsWebhook.id,
                ownedBy: transcriptsWebhook.ownedBy,
                siteUrl: transcriptsWebhook.siteUrl,
                filter: transcriptsWebhook.filter
              });
            }
            
            console.log('   📊 Total webhooks for this site:', allWebhooks.filter(w => 
              w.siteUrl === site.siteUrl || w.name.includes(site.siteUrl) || w.targetUrl.includes(baseUrl)
            ).length);
            
          } else {
            console.log('   ❌ Failed to fetch webhooks:', webhooksResponse.status);
          }
        } catch (error) {
          console.log('   ❌ Error fetching webhooks:', error.message);
        }
      }
    }
    
    // 4. Test webhook endpoints
    console.log('\n4. Testing Webhook Endpoints...');
    try {
      const testResponse = await fetch(`${baseUrl}/api/webhooks/webexmeetings/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'diagnosis', timestamp: new Date().toISOString() })
      });
      
      if (testResponse.ok) {
        console.log('✅ Test webhook endpoint is reachable');
      } else {
        console.log('❌ Test webhook endpoint returned:', testResponse.status);
      }
    } catch (error) {
      console.log('❌ Test webhook endpoint is not reachable:', error.message);
    }
    
    // 5. Check recent webhook logs
    console.log('\n5. Checking Recent Webhook Activity...');
    try {
      const logsResponse = await fetch(`${baseUrl}/api/webexmeetings/settings/webhooklogs`);
      if (logsResponse.ok) {
        const logsData = await logsResponse.json();
        const recentLogs = logsData.logs?.slice(0, 5) || [];
        
        if (recentLogs.length > 0) {
          console.log('✅ Recent webhook activity found:');
          recentLogs.forEach(log => {
            console.log(`   ${log.timestamp}: ${log.webhookType} - ${log.status} - ${log.message}`);
          });
        } else {
          console.log('⚠️  No recent webhook activity found');
        }
      } else {
        console.log('❌ Failed to fetch webhook logs:', logsResponse.status);
      }
    } catch (error) {
      console.log('❌ Error fetching webhook logs:', error.message);
    }
    
    console.log('\n🔍 Diagnosis Complete!');
    console.log('\n📋 Summary:');
    console.log('- Check that webhooks are created with ownedBy: "org" and correct siteUrl');
    console.log('- Ensure NEXTAUTH_URL is properly configured in SSM');
    console.log('- Verify access tokens are valid and not expired');
    console.log('- Confirm recording hosts are correctly configured');
    console.log('- Test webhook endpoints are reachable from Webex');
    
  } catch (error) {
    console.error('❌ Diagnosis failed:', error);
  }
}

// Run the diagnosis
diagnoseWebexWebhooks();