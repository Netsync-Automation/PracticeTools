import { getSecureParameter } from './lib/ssm-config.js';

process.env.ENVIRONMENT = 'dev';

async function testSingleOrgWebhook() {
  const accessToken = await getSecureParameter('/PracticeTools/dev/NETSYNC_WEBEX_MEETINGS_ACCESS_TOKEN');
  
  console.log('=== TESTING SINGLE ORG-LEVEL RECORDINGS WEBHOOK ===');
  
  // First, clean up any existing webhooks
  console.log('\n1. Cleaning up existing webhooks');
  const listResponse = await fetch('https://webexapis.com/v1/webhooks', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  if (listResponse.ok) {
    const webhooks = await listResponse.json();
    console.log(`Found ${webhooks.items.length} existing webhooks`);
    
    for (const webhook of webhooks.items) {
      console.log(`Deleting: ${webhook.name} (${webhook.id})`);
      await fetch(`https://webexapis.com/v1/webhooks/${webhook.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
    }
  }
  
  // Wait a moment for cleanup
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Now try to create just the recordings webhook with org ownership
  console.log('\n2. Creating org-level recordings webhook');
  const recordingsPayload = {
    name: 'PracticeTools Recordings - Test',
    targetUrl: 'https://czpifmw72k.us-east-1.awsapprunner.com/api/webhooks/webexmeetings/recordings',
    resource: 'recordings',
    event: 'created',
    ownedBy: 'org'
  };
  
  console.log('Payload:', JSON.stringify(recordingsPayload, null, 2));
  
  const recordingsResponse = await fetch('https://webexapis.com/v1/webhooks', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(recordingsPayload)
  });
  
  console.log(`Recordings webhook status: ${recordingsResponse.status}`);
  
  if (recordingsResponse.ok) {
    const result = await recordingsResponse.json();
    console.log('✅ SUCCESS! Recordings webhook created:', result.id);
    console.log('Webhook details:', {
      id: result.id,
      name: result.name,
      resource: result.resource,
      event: result.event,
      ownedBy: result.ownedBy,
      status: result.status
    });
  } else {
    const error = await recordingsResponse.text();
    console.log('❌ FAILED:', error);
  }
  
  // Check final webhook list
  console.log('\n3. Final webhook list');
  const finalListResponse = await fetch('https://webexapis.com/v1/webhooks', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  if (finalListResponse.ok) {
    const finalWebhooks = await finalListResponse.json();
    console.log(`Total webhooks: ${finalWebhooks.items.length}`);
    finalWebhooks.items.forEach(w => {
      console.log(`- ${w.name}: ${w.resource}/${w.event} (${w.ownedBy})`);
    });
  }
}

testSingleOrgWebhook().catch(console.error);