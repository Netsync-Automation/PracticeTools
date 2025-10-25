import { getSecureParameter } from './lib/ssm-config.js';

process.env.ENVIRONMENT = 'dev';

async function checkClientInfo() {
  const accessToken = await getSecureParameter('/PracticeTools/dev/NETSYNC_WEBEX_MEETINGS_ACCESS_TOKEN');
  
  console.log('=== CHECKING CLIENT AND APPLICATION INFO ===');
  
  // 1. Get current user/app info
  console.log('\n1. Getting current user info');
  const userResponse = await fetch('https://webexapis.com/v1/people/me', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  if (userResponse.ok) {
    const user = await userResponse.json();
    console.log('User info:', {
      id: user.id,
      emails: user.emails,
      displayName: user.displayName,
      orgId: user.orgId
    });
  }
  
  // 2. Check the existing webhook details more thoroughly
  console.log('\n2. Detailed webhook analysis');
  const webhooksResponse = await fetch('https://webexapis.com/v1/webhooks', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  if (webhooksResponse.ok) {
    const webhooks = await webhooksResponse.json();
    console.log(`Found ${webhooks.items.length} webhooks:`);
    
    webhooks.items.forEach(webhook => {
      console.log(`\nWebhook: ${webhook.name}`);
      console.log(`  ID: ${webhook.id}`);
      console.log(`  Resource: ${webhook.resource}`);
      console.log(`  Event: ${webhook.event}`);
      console.log(`  OwnedBy: ${webhook.ownedBy}`);
      console.log(`  Status: ${webhook.status}`);
      console.log(`  AppId: ${webhook.appId}`);
      console.log(`  CreatedBy: ${webhook.createdBy}`);
      console.log(`  OrgId: ${webhook.orgId}`);
      console.log(`  Created: ${webhook.created}`);
      console.log(`  TargetUrl: ${webhook.targetUrl}`);
    });
  }
  
  // 3. Try to create org webhook with different target URL
  console.log('\n3. Testing org webhook with different target URL');
  const differentUrlPayload = {
    name: 'Test Different URL',
    targetUrl: 'https://example.com/webhook',
    resource: 'meetingTranscripts',
    event: 'created',
    ownedBy: 'org'
  };
  
  const differentUrlResponse = await fetch('https://webexapis.com/v1/webhooks', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(differentUrlPayload)
  });
  
  console.log(`Different URL test status: ${differentUrlResponse.status}`);
  if (!differentUrlResponse.ok) {
    const error = await differentUrlResponse.text();
    console.log(`Error: ${error}`);
  }
  
  // 4. Try with different event
  console.log('\n4. Testing org webhook with different event');
  const differentEventPayload = {
    name: 'Test Different Event',
    targetUrl: 'https://czpifmw72k.us-east-1.awsapprunner.com/api/webhooks/test',
    resource: 'meetingTranscripts',
    event: 'updated',
    ownedBy: 'org'
  };
  
  const differentEventResponse = await fetch('https://webexapis.com/v1/webhooks', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(differentEventPayload)
  });
  
  console.log(`Different event test status: ${differentEventResponse.status}`);
  if (!differentEventResponse.ok) {
    const error = await differentEventResponse.text();
    console.log(`Error: ${error}`);
  } else {
    const result = await differentEventResponse.json();
    console.log(`Success: ${result.id}`);
    
    // Clean up
    await fetch(`https://webexapis.com/v1/webhooks/${result.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    console.log('Test webhook deleted');
  }
}

checkClientInfo().catch(console.error);