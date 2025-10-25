#!/usr/bin/env node

/**
 * Check Webex Meetings Configuration in Database
 * Verifies that recording hosts are stored as user IDs
 */

import { getTableName } from './lib/dynamodb.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function checkWebexConfig() {
  console.log('🔍 Checking Webex Meetings Configuration in Database');
  console.log('=' .repeat(55));
  
  try {
    const tableName = getTableName('Settings');
    console.log(`\n📋 Reading from table: ${tableName}`);
    
    const command = new GetCommand({
      TableName: tableName,
      Key: { setting_key: 'webex-meetings' }
    });
    
    const result = await docClient.send(command);
    
    if (!result.Item?.setting_value) {
      console.log('❌ No webex-meetings configuration found');
      return;
    }
    
    const config = JSON.parse(result.Item.setting_value);
    console.log(`\n✅ Configuration found`);
    console.log(`   Enabled: ${config.enabled}`);
    console.log(`   Sites: ${config.sites?.length || 0}`);
    console.log(`   Last Updated: ${result.Item.updated_at}`);
    
    if (config.sites?.length > 0) {
      for (const site of config.sites) {
        console.log(`\n🌐 Site: ${site.siteName || site.siteUrl}`);
        console.log(`   URL: ${site.siteUrl}`);
        console.log(`   Recording Hosts: ${site.recordingHosts?.length || 0}`);
        
        if (site.recordingHosts?.length > 0) {
          site.recordingHosts.forEach((host, index) => {
            if (typeof host === 'object') {
              console.log(`   Host ${index + 1}: ${host.email}`);
              console.log(`      Email: ${host.email}`);
              console.log(`      User ID: ${host.userId || 'Not resolved'}`);
              console.log(`      Status: ${host.userId ? '✅ Ready for webhook matching' : '⚠️  User ID not resolved'}`);
            } else {
              const isUserId = host.startsWith('Y2lzY29zcGFyazovL3VzL1BFT1BMRS8');
              const isEmail = host.includes('@');
              console.log(`   Host ${index + 1}: ${host}`);
              console.log(`      Format: ${isUserId ? '✅ User ID' : isEmail ? '⚠️  Email' : '❓ Unknown'}`);
            }
          });
        }
        
        if (site.recordingsWebhookId) {
          console.log(`   Recordings Webhook: ${site.recordingsWebhookId}`);
        }
        if (site.transcriptsWebhookId) {
          console.log(`   Transcripts Webhook: ${site.transcriptsWebhookId}`);
        }
      }
    }
    
    // Check if all hosts have user IDs resolved
    const allSitesReady = config.sites?.every(site => 
      site.recordingHosts?.every(host => 
        typeof host === 'object' ? host.userId : host.startsWith('Y2lzY29zcGFyazovL3VzL1BFT1BMRS8') 
      )
    );
    
    console.log(`\n🎯 Webhook Compatibility Status:`);
    if (allSitesReady) {
      console.log('   ✅ All recording hosts have user IDs resolved');
      console.log('   ✅ Webhooks should match properly');
    } else {
      console.log('   ⚠️  Some recording hosts missing user IDs');
      console.log('   ⚠️  Webhooks may not match properly');
      console.log('   💡 Re-save the configuration to trigger conversion');
    }
    
  } catch (error) {
    console.error('❌ Error checking configuration:', error.message);
  }
}

// Run the check
checkWebexConfig().catch(console.error);