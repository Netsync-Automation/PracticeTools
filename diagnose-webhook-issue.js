#!/usr/bin/env node

/**
 * Webex Meetings Webhook Diagnostic Script
 * 
 * This script helps diagnose issues with Webex Meetings webhooks not receiving
 * recording notifications from specific hosts like mbgriffin@netsync.com
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { getSecureParameter } = require('./lib/ssm-config');
const { getEnvironment, getTableName } = require('./lib/dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function getWebexMeetingsConfig() {
  const tableName = getTableName('Settings');
  const command = new GetCommand({
    TableName: tableName,
    Key: { setting_key: 'webex-meetings' }
  });
  const result = await docClient.send(command);
  return result.Item?.setting_value ? JSON.parse(result.Item.setting_value) : null;
}

async function getWebhookLogs() {
  try {
    const tableName = getTableName('WebexMeetingsWebhookLogs');
    const scanCommand = new ScanCommand({
      TableName: tableName,
      Limit: 50
    });
    const result = await docClient.send(scanCommand);
    return result.Items || [];
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      return [];
    }
    throw error;
  }
}

async function validateWebhooks(config) {
  const results = [];
  const baseUrl = process.env.NEXTAUTH_URL || 'https://your-domain.com';
  
  for (const site of config.sites) {
    console.log(`\n🔍 Validating webhooks for site: ${site.siteUrl}`);
    
    // Get access token from SSM
    const env = getEnvironment();
    const siteName = site.siteUrl.split('.')[0].toUpperCase();
    const basePath = env === 'prod' ? '/PracticeTools' : '/PracticeTools/dev';
    const accessTokenParam = `${basePath}/${siteName}_WEBEX_MEETINGS_ACCESS_TOKEN`;
    
    try {
      const accessToken = await getSecureParameter(accessTokenParam);
      if (!accessToken) {
        results.push({
          site: site.siteUrl,
          status: 'error',
          error: `No access token found in SSM: ${accessTokenParam}`
        });
        continue;
      }
      
      // Get all webhooks from Webex
      const response = await fetch('https://webexapis.com/v1/webhooks', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (!response.ok) {
        results.push({
          site: site.siteUrl,
          status: 'error',
          error: `Failed to fetch webhooks: ${response.status} ${response.statusText}`
        });
        continue;
      }
      
      const data = await response.json();
      const webhooks = data.items || [];
      
      // Find our webhooks
      const recordingsWebhook = webhooks.find(w => 
        w.targetUrl === `${baseUrl}/api/webhooks/webexmeetings/recordings` &&
        w.resource === 'recordings'
      );
      
      const transcriptsWebhook = webhooks.find(w => 
        w.targetUrl === `${baseUrl}/api/webhooks/webexmeetings/transcripts` &&
        w.resource === 'meetingTranscripts'
      );
      
      results.push({
        site: site.siteUrl,
        recordingHosts: site.recordingHosts,
        totalWebhooks: webhooks.length,
        hasRecordingsWebhook: !!recordingsWebhook,
        hasTranscriptsWebhook: !!transcriptsWebhook,
        recordingsWebhookDetails: recordingsWebhook ? {
          id: recordingsWebhook.id,
          status: recordingsWebhook.status,
          filter: recordingsWebhook.filter,
          created: recordingsWebhook.created
        } : null,
        transcriptsWebhookDetails: transcriptsWebhook ? {
          id: transcriptsWebhook.id,
          status: transcriptsWebhook.status,
          filter: transcriptsWebhook.filter,
          created: transcriptsWebhook.created
        } : null,
        allWebhooks: webhooks.map(w => ({
          id: w.id,
          name: w.name,
          resource: w.resource,
          event: w.event,
          targetUrl: w.targetUrl,
          status: w.status,
          filter: w.filter
        }))
      });
      
    } catch (error) {
      results.push({
        site: site.siteUrl,
        status: 'error',
        error: error.message
      });
    }
  }
  
  return results;
}

async function main() {
  console.log('🔧 Webex Meetings Webhook Diagnostic Tool');
  console.log('==========================================\n');
  
  try {
    // 1. Check configuration
    console.log('1. Checking Webex Meetings configuration...');
    const config = await getWebexMeetingsConfig();
    
    if (!config) {
      console.log('❌ No Webex Meetings configuration found');
      return;
    }
    
    if (!config.enabled) {
      console.log('❌ Webex Meetings integration is disabled');
      return;
    }
    
    console.log(`✅ Configuration found with ${config.sites?.length || 0} sites`);
    
    // 2. Display configuration details
    console.log('\n2. Configuration Details:');
    config.sites.forEach((site, index) => {
      console.log(`   Site ${index + 1}: ${site.siteUrl}`);
      console.log(`   Recording Hosts: ${site.recordingHosts.join(', ')}`);
      console.log(`   Has mbgriffin@netsync.com: ${site.recordingHosts.includes('mbgriffin@netsync.com') ? '✅' : '❌'}`);
      console.log('');
    });
    
    // 3. Validate webhooks
    console.log('3. Validating webhooks...');
    const webhookResults = await validateWebhooks(config);
    
    webhookResults.forEach(result => {
      console.log(`\n📍 Site: ${result.site}`);
      if (result.error) {
        console.log(`   ❌ Error: ${result.error}`);
        return;
      }
      
      console.log(`   Total webhooks in Webex: ${result.totalWebhooks}`);
      console.log(`   Recordings webhook: ${result.hasRecordingsWebhook ? '✅' : '❌'}`);
      console.log(`   Transcripts webhook: ${result.hasTranscriptsWebhook ? '✅' : '❌'}`);
      
      if (result.recordingsWebhookDetails) {
        console.log(`   Recordings webhook ID: ${result.recordingsWebhookDetails.id}`);
        console.log(`   Recordings webhook status: ${result.recordingsWebhookDetails.status}`);
        console.log(`   Recordings webhook filter: ${result.recordingsWebhookDetails.filter || 'none'}`);
      }
      
      if (result.transcriptsWebhookDetails) {
        console.log(`   Transcripts webhook ID: ${result.transcriptsWebhookDetails.id}`);
        console.log(`   Transcripts webhook status: ${result.transcriptsWebhookDetails.status}`);
        console.log(`   Transcripts webhook filter: ${result.transcriptsWebhookDetails.filter || 'none'}`);
      }
      
      console.log(`   Recording hosts configured: ${result.recordingHosts.join(', ')}`);
    });
    
    // 4. Check recent webhook logs
    console.log('\n4. Checking recent webhook activity...');
    const logs = await getWebhookLogs();
    
    if (logs.length === 0) {
      console.log('   ⚠️  No webhook activity logs found');
    } else {
      console.log(`   Found ${logs.length} recent webhook activities:`);
      
      // Sort by timestamp and show last 10
      const recentLogs = logs
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10);
      
      recentLogs.forEach(log => {
        const status = log.status === 'success' ? '✅' : log.status === 'warning' ? '⚠️' : '❌';
        console.log(`   ${status} ${log.timestamp} - ${log.webhookType} - ${log.siteUrl} - ${log.message}`);
        if (log.error) {
          console.log(`      Error: ${log.error}`);
        }
      });
    }
    
    // 5. Recommendations
    console.log('\n5. Recommendations:');
    
    const hasValidWebhooks = webhookResults.some(r => r.hasRecordingsWebhook && r.hasTranscriptsWebhook);
    if (!hasValidWebhooks) {
      console.log('   ❌ No valid webhooks found. Create webhooks using the admin interface.');
    }
    
    const hasMbGriffin = config.sites.some(s => s.recordingHosts.includes('mbgriffin@netsync.com'));
    if (!hasMbGriffin) {
      console.log('   ❌ mbgriffin@netsync.com is not configured as a recording host. Add it to the site configuration.');
    }
    
    const hasFilters = webhookResults.some(r => 
      r.recordingsWebhookDetails?.filter || r.transcriptsWebhookDetails?.filter
    );
    if (hasFilters) {
      console.log('   ✅ Webhooks have filters configured to target specific hosts.');
    } else {
      console.log('   ⚠️  Webhooks do not have host filters. This may cause issues with host validation.');
    }
    
    if (logs.length === 0) {
      console.log('   ⚠️  No webhook activity detected. Test by creating a recording with mbgriffin@netsync.com as host.');
    }
    
    console.log('\n✅ Diagnostic complete!');
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };