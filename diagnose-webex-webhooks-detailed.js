#!/usr/bin/env node

/**
 * Detailed Webex Webhook Diagnostic Tool
 * Checks webhook registration, tokens, and configuration
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const ssmClient = new SSMClient({ region: 'us-east-1' });

const ENV = process.env.ENVIRONMENT || 'dev';

async function getSSMParameter(path) {
  try {
    const result = await ssmClient.send(new GetParameterCommand({ Name: path }));
    return result.Parameter.Value;
  } catch (error) {
    return null;
  }
}

async function checkWebexConfig() {
  console.log('\n========== WEBEX CONFIGURATION CHECK ==========\n');
  
  const tableName = `PracticeTools-${ENV}-Settings`;
  console.log(`📋 Checking table: ${tableName}`);
  
  try {
    const result = await docClient.send(new GetCommand({
      TableName: tableName,
      Key: { setting_key: 'webex-meetings' }
    }));
    
    if (!result.Item) {
      console.log('❌ No webex-meetings configuration found');
      return null;
    }
    
    const config = JSON.parse(result.Item.setting_value);
    console.log(`✅ Configuration found`);
    console.log(`   Enabled: ${config.enabled}`);
    console.log(`   Sites: ${config.sites?.length || 0}`);
    
    return config;
  } catch (error) {
    console.log(`❌ Error loading config: ${error.message}`);
    return null;
  }
}

async function checkSSMTokens(siteUrl) {
  const siteName = siteUrl.replace(/^https?:\/\//, '').split('.')[0].toUpperCase();
  const prefix = ENV === 'prod' ? '/PracticeTools' : '/PracticeTools/dev';
  
  console.log(`\n🔑 Checking SSM tokens for ${siteName}:`);
  
  const params = {
    accessToken: `${prefix}/${siteName}_WEBEX_MEETINGS_ACCESS_TOKEN`,
    refreshToken: `${prefix}/${siteName}_WEBEX_MEETINGS_REFRESH_TOKEN`,
    clientId: `${prefix}/${siteName}_WEBEX_MEETINGS_CLIENT_ID`,
    clientSecret: `${prefix}/${siteName}_WEBEX_MEETINGS_CLIENT_SECRET`,
    botToken: `${prefix}/${siteName}_WEBEX_MESSAGING_BOT_TOKEN_1`,
    roomName: `${prefix}/${siteName}_WEBEX_MESSAGING_ROOM_NAME_1`,
    roomId: `${prefix}/${siteName}_WEBEX_MESSAGING_ROOM_ID_1`
  };
  
  const results = {};
  for (const [key, path] of Object.entries(params)) {
    const value = await getSSMParameter(path);
    results[key] = !!value;
    const status = value ? '✅' : '❌';
    const preview = value ? `(${value.substring(0, 20)}...)` : '';
    console.log(`   ${status} ${key}: ${path} ${preview}`);
  }
  
  return results;
}

async function checkWebexWebhooks(accessToken, baseUrl) {
  console.log(`\n🌐 Checking Webex webhooks:`);
  
  try {
    const response = await fetch('https://webexapis.com/v1/webhooks', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!response.ok) {
      console.log(`❌ Failed to fetch webhooks: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    const webhooks = data.items || [];
    
    console.log(`   Total webhooks: ${webhooks.length}`);
    
    const recordingsWebhook = webhooks.find(w => 
      w.targetUrl === `${baseUrl}/api/webhooks/webexmeetings/recordings` &&
      w.resource === 'recordings'
    );
    
    const messagingWebhooks = webhooks.filter(w =>
      w.targetUrl === `${baseUrl}/api/webhooks/webexmessaging/messages` &&
      w.resource === 'messages'
    );
    
    if (recordingsWebhook) {
      console.log(`   ✅ Recordings webhook: ${recordingsWebhook.id}`);
      console.log(`      Status: ${recordingsWebhook.status}`);
      console.log(`      Created: ${recordingsWebhook.created}`);
    } else {
      console.log(`   ❌ Recordings webhook: NOT FOUND`);
    }
    
    if (messagingWebhooks.length > 0) {
      console.log(`   ✅ Messaging webhooks: ${messagingWebhooks.length}`);
      messagingWebhooks.forEach(w => {
        console.log(`      - ${w.id} (${w.filter})`);
      });
    } else {
      console.log(`   ❌ Messaging webhooks: NOT FOUND`);
    }
    
    return webhooks;
  } catch (error) {
    console.log(`❌ Error fetching webhooks: ${error.message}`);
    return [];
  }
}

async function checkRecentWebhookLogs() {
  console.log(`\n📊 Checking recent webhook logs:`);
  
  const tableName = `PracticeTools-${ENV}-WebexMeetingsWebhookLogs`;
  
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: tableName,
      Limit: 10
    }));
    
    const logs = (result.Items || []).sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    if (logs.length === 0) {
      console.log(`   ⚠️  No webhook logs found`);
      return;
    }
    
    console.log(`   Found ${logs.length} recent logs:\n`);
    
    logs.forEach(log => {
      const status = log.status === 'success' ? '✅' : log.status === 'error' ? '❌' : '⚠️';
      console.log(`   ${status} ${log.timestamp}`);
      console.log(`      Type: ${log.webhookType}`);
      console.log(`      Site: ${log.siteUrl}`);
      console.log(`      Status: ${log.status}`);
      console.log(`      Message: ${log.message}`);
      if (log.error) {
        console.log(`      Error: ${log.error}`);
      }
      console.log('');
    });
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      console.log(`   ⚠️  Webhook logs table does not exist yet`);
    } else {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
}

async function testWebhookConnectivity(baseUrl) {
  console.log(`\n🔌 Testing webhook endpoint connectivity:`);
  console.log(`   Base URL: ${baseUrl}`);
  
  const endpoints = [
    '/api/webhooks/webexmeetings/recordings',
    '/api/webhooks/webexmessaging/messages'
  ];
  
  for (const endpoint of endpoints) {
    const url = `${baseUrl}${endpoint}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true })
      });
      
      const status = response.ok ? '✅' : '⚠️';
      console.log(`   ${status} ${endpoint}: ${response.status}`);
    } catch (error) {
      console.log(`   ❌ ${endpoint}: ${error.message}`);
    }
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Webex Webhook Detailed Diagnostic Tool                ║');
  console.log('║     Environment: ' + ENV.padEnd(42) + '║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  // Check configuration
  const config = await checkWebexConfig();
  if (!config) {
    console.log('\n❌ Cannot proceed without configuration');
    return;
  }
  
  // Get base URL
  const baseUrl = await getSSMParameter(
    ENV === 'prod' ? '/PracticeTools/NEXTAUTH_URL' : '/PracticeTools/dev/NEXTAUTH_URL'
  );
  console.log(`\n🌐 Base URL: ${baseUrl || 'NOT FOUND'}`);
  
  // Check each site
  for (const site of config.sites || []) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`SITE: ${site.siteName || site.siteUrl}`);
    console.log('='.repeat(60));
    
    // Check SSM tokens
    const tokens = await checkSSMTokens(site.siteUrl);
    
    // Check webhooks if we have access token
    if (tokens.accessToken && baseUrl) {
      const siteName = site.siteUrl.replace(/^https?:\/\//, '').split('.')[0].toUpperCase();
      const prefix = ENV === 'prod' ? '/PracticeTools' : '/PracticeTools/dev';
      const accessToken = await getSSMParameter(`${prefix}/${siteName}_WEBEX_MEETINGS_ACCESS_TOKEN`);
      
      if (accessToken) {
        await checkWebexWebhooks(accessToken, baseUrl);
      }
    }
    
    // Show site configuration
    console.log(`\n📝 Site Configuration:`);
    console.log(`   Recording Webhook ID: ${site.recordingWebhookId || 'NOT SET'}`);
    console.log(`   Messaging Webhook IDs: ${site.messagingWebhookIds?.length || 0}`);
    console.log(`   Recording Hosts: ${site.recordingHosts?.length || 0}`);
    console.log(`   Monitored Rooms: ${site.monitoredRooms?.length || 0}`);
  }
  
  // Check recent logs
  await checkRecentWebhookLogs();
  
  // Test connectivity
  if (baseUrl) {
    await testWebhookConnectivity(baseUrl);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('DIAGNOSTIC COMPLETE');
  console.log('='.repeat(60) + '\n');
  
  console.log('📋 Next Steps:');
  console.log('   1. Review any ❌ items above');
  console.log('   2. Check CloudWatch Logs for detailed traces');
  console.log('   3. Validate webhooks via Admin UI');
  console.log('   4. Test with a real recording or message');
  console.log('');
}

main().catch(console.error);
