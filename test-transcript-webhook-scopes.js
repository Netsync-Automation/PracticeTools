import { getSecureParameter } from './lib/ssm-config.js';

process.env.ENVIRONMENT = 'dev';

async function testTranscriptWebhookScopes() {
  const accessToken = await getSecureParameter('/PracticeTools/dev/NETSYNC_WEBEX_MEETINGS_ACCESS_TOKEN');
  
  console.log('=== TESTING TRANSCRIPT WEBHOOK CREATION WITH DIFFERENT PARAMETERS ===');
  
  // Test 1: Try with ownedBy: 'creator' instead of 'org'
  console.log('\n1. Testing with ownedBy: creator');
  const creatorPayload = {
    name: 'Test Transcripts - Creator',
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
  
  console.log('Creator webhook status:', creatorResponse.status);
  if (!creatorResponse.ok) {
    const error = await creatorResponse.text();
    console.log('Creator webhook error:', error);
  } else {
    const result = await creatorResponse.json();
    console.log('Creator webhook created:', result.id);
    
    // Clean up - delete the test webhook
    await fetch(`https://webexapis.com/v1/webhooks/${result.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    console.log('Test webhook deleted');
  }
  
  // Test 2: Check if we can create other types of webhooks
  console.log('\n2. Testing meetings webhook creation');
  const meetingsPayload = {
    name: 'Test Meetings Webhook',
    targetUrl: 'https://czpifmw72k.us-east-1.awsapprunner.com/api/webhooks/test',
    resource: 'meetings',
    event: 'created',
    ownedBy: 'org'
  };
  
  const meetingsResponse = await fetch('https://webexapis.com/v1/webhooks', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(meetingsPayload)
  });
  
  console.log('Meetings webhook status:', meetingsResponse.status);
  if (!meetingsResponse.ok) {
    const error = await meetingsResponse.text();
    console.log('Meetings webhook error:', error);
  } else {
    const result = await meetingsResponse.json();
    console.log('Meetings webhook created:', result.id);
    
    // Clean up
    await fetch(`https://webexapis.com/v1/webhooks/${result.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    console.log('Test webhook deleted');
  }
  
  // Test 3: Check current transcript webhook status
  console.log('\n3. Checking current transcript webhook details');
  const webhooksResponse = await fetch('https://webexapis.com/v1/webhooks', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  if (webhooksResponse.ok) {
    const webhooks = await webhooksResponse.json();
    const transcriptWebhook = webhooks.items.find(w => w.resource === 'meetingTranscripts');
    
    if (transcriptWebhook) {
      console.log('Current transcript webhook:', {
        id: transcriptWebhook.id,
        status: transcriptWebhook.status,
        resource: transcriptWebhook.resource,
        event: transcriptWebhook.event,
        ownedBy: transcriptWebhook.ownedBy,
        siteUrl: transcriptWebhook.siteUrl,
        created: transcriptWebhook.created
      });
    }
  }
}

testTranscriptWebhookScopes().catch(console.error);