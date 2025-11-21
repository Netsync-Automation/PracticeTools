#!/usr/bin/env node
import { getValidAccessToken } from './lib/webex-token-manager.js';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getTableName } from './lib/dynamodb.js';

const ssmClient = new SSMClient({ region: 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const ENV = process.env.ENVIRONMENT || 'dev';

async function getSSMParam(path) {
  try {
    const result = await ssmClient.send(new GetParameterCommand({ Name: path }));
    return result.Parameter.Value;
  } catch (error) {
    return null;
  }
}

async function getConfig() {
  const tableName = getTableName('Settings');
  const result = await docClient.send(new GetCommand({
    TableName: tableName,
    Key: { setting_key: 'webex-meetings' }
  }));
  return result.Item?.setting_value ? JSON.parse(result.Item.setting_value) : null;
}

async function main() {
  const baseUrl = await getSSMParam(`/PracticeTools/${ENV}/NEXTAUTH_URL`);
  const config = await getConfig();
  
  console.log(`\n=== Creating Webhooks ===`);
  console.log(`Base URL: ${baseUrl}\n`);
  
  const site = config.sites[0];
  const siteUrl = site.siteUrl;
  
  console.log(`Site: ${siteUrl}`);
  console.log(`Site Name: ${site.siteName}\n`);
  
  const accessToken = await getValidAccessToken(siteUrl);
  
  // Check existing webhooks
  const existingResponse = await fetch('https://webexapis.com/v1/webhooks', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const existingData = await existingResponse.json();
  const existing = existingData.items || [];
  
  console.log(`Existing webhooks in Webex: ${existing.length}\n`);
  
  const existingRecording = existing.find(w => 
    w.targetUrl === `${baseUrl}/api/webhooks/webexmeetings/recordings` &&
    w.resource === 'recordings'
  );
  
  if (existingRecording) {
    console.log(`✅ Recording webhook already exists: ${existingRecording.id}`);
    console.log(`   Status: ${existingRecording.status}\n`);
  } else {
    console.log('Creating recordings webhook...');
    
    const payload = {
      name: `PracticeTools Recordings - ${site.siteName}`,
      targetUrl: `${baseUrl}/api/webhooks/webexmeetings/recordings`,
      resource: 'recordings',
      event: 'created',
      ownedBy: 'org'
    };
    
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
    const response = await fetch('https://webexapis.com/v1/webhooks', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    console.log(`Response status: ${response.status}`);
    
    const result = await response.json();
    console.log('Response:', JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log(`\n✅ Recording webhook created: ${result.id}`);
      console.log(`   Status: ${result.status}`);
    } else {
      console.log(`\n❌ Failed to create recording webhook`);
      console.log(`   Error: ${result.message || result.errors?.[0]?.description}`);
    }
  }
  
  // Check for monitored rooms
  const botToken = await getSSMParam(`/PracticeTools/${ENV}/NETSYNC_WEBEX_MESSAGING_BOT_TOKEN_1`);
  const roomName = await getSSMParam(`/PracticeTools/${ENV}/NETSYNC_WEBEX_MESSAGING_ROOM_NAME_1`);
  const roomId = await getSSMParam(`/PracticeTools/${ENV}/NETSYNC_WEBEX_MESSAGING_ROOM_ID_1`);
  
  if (roomId) {
    console.log(`\n\nMonitored room: ${roomName} (${roomId})`);
    
    const existingMessage = existing.find(w =>
      w.targetUrl === `${baseUrl}/api/webhooks/webexmessaging/messages` &&
      w.resource === 'messages' &&
      w.filter === `roomId=${roomId}`
    );
    
    if (existingMessage) {
      console.log(`✅ Message webhook already exists: ${existingMessage.id}`);
      console.log(`   Status: ${existingMessage.status}`);
    } else {
      console.log('Creating message webhook...');
      
      const payload = {
        name: `PracticeTools Messages - ${roomName}`,
        targetUrl: `${baseUrl}/api/webhooks/webexmessaging/messages`,
        resource: 'messages',
        event: 'created',
        filter: `roomId=${roomId}`
      };
      
      console.log('Payload:', JSON.stringify(payload, null, 2));
      
      const response = await fetch('https://webexapis.com/v1/webhooks', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      console.log(`Response status: ${response.status}`);
      
      const result = await response.json();
      console.log('Response:', JSON.stringify(result, null, 2));
      
      if (response.ok) {
        console.log(`\n✅ Message webhook created: ${result.id}`);
        console.log(`   Status: ${result.status}`);
      } else {
        console.log(`\n❌ Failed to create message webhook`);
        console.log(`   Error: ${result.message || result.errors?.[0]?.description}`);
      }
    }
  }
}

main().catch(console.error);
