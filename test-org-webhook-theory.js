import { getSecureParameter } from './lib/ssm-config.js';

process.env.ENVIRONMENT = 'dev';

async function testOrgWebhookTheory() {
  const accessToken = await getSecureParameter('/PracticeTools/dev/NETSYNC_WEBEX_MEETINGS_ACCESS_TOKEN');
  
  console.log('=== TESTING ORG WEBHOOK THEORY ===');
  
  // 1. Check current webhooks
  console.log('\n1. Current webhooks:');
  const webhooksResponse = await fetch('https://webexapis.com/v1/webhooks', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  if (webhooksResponse.ok) {
    const webhooks = await webhooksResponse.json();
    webhooks.items.forEach(w => {
      console.log(`- ${w.resource}/${w.event}: ${w.ownedBy} (${w.name})`);
    });
  }
  
  // 2. Try to create org-level recordings webhook
  console.log('\n2. Testing org-level recordings webhook:');
  const recordingsPayload = {
    name: 'Test Recordings Org',
    targetUrl: 'https://czpifmw72k.us-east-1.awsapprunner.com/api/webhooks/test',
    resource: 'recordings',
    event: 'created',
    ownedBy: 'org'
  };
  
  const recordingsResponse = await fetch('https://webexapis.com/v1/webhooks', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(recordingsPayload)
  });
  
  console.log(`Recordings org webhook status: ${recordingsResponse.status}`);
  if (!recordingsResponse.ok) {
    const error = await recordingsResponse.text();
    console.log(`Error: ${error}`);
  } else {
    const result = await recordingsResponse.json();
    console.log(`Success: ${result.id}`);
    
    // 3. Now try to create org-level transcripts webhook
    console.log('\n3. Testing org-level transcripts webhook (with recordings org webhook existing):');
    const transcriptsPayload = {
      name: 'Test Transcripts Org',
      targetUrl: 'https://czpifmw72k.us-east-1.awsapprunner.com/api/webhooks/test2',
      resource: 'meetingTranscripts',
      event: 'created',
      ownedBy: 'org'
    };
    
    const transcriptsResponse = await fetch('https://webexapis.com/v1/webhooks', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(transcriptsPayload)
    });
    
    console.log(`Transcripts org webhook status: ${transcriptsResponse.status}`);
    if (!transcriptsResponse.ok) {
      const error = await transcriptsResponse.text();
      console.log(`Error: ${error}`);
    } else {
      const transcriptResult = await transcriptsResponse.json();
      console.log(`Success: ${transcriptResult.id}`);
      
      // Clean up transcript webhook
      await fetch(`https://webexapis.com/v1/webhooks/${transcriptResult.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
    }
    
    // Clean up recordings webhook
    await fetch(`https://webexapis.com/v1/webhooks/${result.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    console.log('Test webhooks cleaned up');
  }
  
  // 4. Test the reverse - create transcripts first, then recordings
  console.log('\n4. Testing reverse order (transcripts first, then recordings):');
  const transcriptsFirstResponse = await fetch('https://webexapis.com/v1/webhooks', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Test Transcripts First',
      targetUrl: 'https://czpifmw72k.us-east-1.awsapprunner.com/api/webhooks/test3',
      resource: 'meetingTranscripts',
      event: 'created',
      ownedBy: 'org'
    })
  });
  
  console.log(`Transcripts first status: ${transcriptsFirstResponse.status}`);
  if (!transcriptsFirstResponse.ok) {
    const error = await transcriptsFirstResponse.text();
    console.log(`Error: ${error}`);
  }
}

testOrgWebhookTheory().catch(console.error);