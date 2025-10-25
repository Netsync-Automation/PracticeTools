import { getSecureParameter } from './lib/ssm-config.js';

process.env.ENVIRONMENT = 'dev';

async function testWebhookCreation() {
  const accessToken = await getSecureParameter('/PracticeTools/dev/NETSYNC_WEBEX_MEETINGS_ACCESS_TOKEN');
  
  console.log('=== TESTING WEBHOOK CREATION ===');
  
  // Try creating with ownedBy: 'creator' first
  console.log('\n1. Testing transcript webhook with ownedBy: creator');
  const creatorPayload = {
    name: 'PracticeTools Transcripts - Creator Test',
    targetUrl: 'https://czpifmw72k.us-east-1.awsapprunner.com/api/webhooks/webexmeetings/transcripts',
    resource: 'meetingTranscripts',
    event: 'created',
    ownedBy: 'creator'
  };
  
  const creatorResponse = await fetch('https://webexapis.com/v1/webhooks', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(creatorPayload)
  });
  
  console.log('Creator response status:', creatorResponse.status);
  const creatorResult = await creatorResponse.text();
  console.log('Creator response:', creatorResult);
  
  // Try creating with ownedBy: 'org'
  console.log('\n2. Testing transcript webhook with ownedBy: org');
  const orgPayload = {
    name: 'PracticeTools Transcripts - Org Test',
    targetUrl: 'https://czpifmw72k.us-east-1.awsapprunner.com/api/webhooks/webexmeetings/transcripts',
    resource: 'meetingTranscripts',
    event: 'created',
    ownedBy: 'org'
  };
  
  const orgResponse = await fetch('https://webexapis.com/v1/webhooks', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(orgPayload)
  });
  
  console.log('Org response status:', orgResponse.status);
  const orgResult = await orgResponse.text();
  console.log('Org response:', orgResult);
  
  // Wait a moment and check what webhooks exist now
  console.log('\n3. Checking webhooks after creation attempts');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const listResponse = await fetch('https://webexapis.com/v1/webhooks', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  if (listResponse.ok) {
    const webhooks = await listResponse.json();
    console.log(`Found ${webhooks.items.length} webhooks:`);
    webhooks.items.forEach(w => {
      console.log(`- ${w.name}: ${w.resource}/${w.event} (${w.ownedBy})`);
    });
  }
}

testWebhookCreation().catch(console.error);