#!/usr/bin/env node
import { getValidAccessToken } from './lib/webex-token-manager.js';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssmClient = new SSMClient({ region: 'us-east-1' });
const ENV = process.env.ENVIRONMENT || 'dev';

async function getSSMParam(path) {
  try {
    const result = await ssmClient.send(new GetParameterCommand({ Name: path }));
    return result.Parameter.Value;
  } catch (error) {
    return null;
  }
}

async function main() {
  const siteUrl = 'netsync.webex.com';
  const baseUrl = await getSSMParam(`/PracticeTools/${ENV}/NEXTAUTH_URL`);
  
  console.log(`\n=== Checking Webhooks for ${siteUrl} ===`);
  console.log(`Base URL: ${baseUrl}\n`);
  
  const accessToken = await getValidAccessToken(siteUrl);
  
  const response = await fetch('https://webexapis.com/v1/webhooks', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  const data = await response.json();
  const webhooks = data.items || [];
  
  console.log(`Total webhooks: ${webhooks.length}\n`);
  
  const recordings = webhooks.find(w => 
    w.targetUrl === `${baseUrl}/api/webhooks/webexmeetings/recordings` &&
    w.resource === 'recordings'
  );
  
  const messages = webhooks.filter(w =>
    w.targetUrl === `${baseUrl}/api/webhooks/webexmessaging/messages` &&
    w.resource === 'messages'
  );
  
  if (recordings) {
    console.log('✅ RECORDINGS WEBHOOK:');
    console.log(`   ID: ${recordings.id}`);
    console.log(`   Status: ${recordings.status}`);
    console.log(`   Target: ${recordings.targetUrl}`);
    console.log(`   Created: ${recordings.created}`);
  } else {
    console.log('❌ RECORDINGS WEBHOOK: NOT FOUND');
  }
  
  console.log('');
  
  if (messages.length > 0) {
    console.log(`✅ MESSAGES WEBHOOKS: ${messages.length}`);
    messages.forEach(w => {
      console.log(`   ID: ${w.id}`);
      console.log(`   Status: ${w.status}`);
      console.log(`   Filter: ${w.filter}`);
      console.log(`   Created: ${w.created}`);
      console.log('');
    });
  } else {
    console.log('❌ MESSAGES WEBHOOKS: NOT FOUND');
  }
}

main().catch(console.error);
