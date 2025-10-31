import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssmClient = new SSMClient({ region: 'us-east-1' });

async function getToken() {
  const result = await ssmClient.send(new GetParameterCommand({
    Name: '/PracticeTools/dev/NETSYNC_WEBEX_MEETINGS_ACCESS_TOKEN'
  }));
  return result.Parameter.Value;
}

async function getBotToken() {
  const result = await ssmClient.send(new GetParameterCommand({
    Name: '/PracticeTools/dev/NETSYNC_WEBEX_MESSAGING_BOT_TOKEN_1'
  }));
  return result.Parameter.Value;
}

async function main() {
  const accessToken = await getToken();
  const botToken = await getBotToken();
  
  // Step 1: Get service app user ID
  console.log('\n=== STEP 1: Get Service App User ID ===\n');
  const meResponse = await fetch('https://webexapis.com/v1/people/me', {
    headers: { 
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  const meData = await meResponse.json();
  console.log('Service App User ID:', meData.id);
  console.log('Display Name:', meData.displayName);
  
  const roomId = 'Y2lzY29zcGFyazovL3VzL1JPT00vNmY4NWRhOTAtMmNiNS0xMWVlLWJhMjQtNWI4YzJhZjNjMTMw';
  const roomTitle = 'Netsync Presales Documents';
  
  // Step 2: Add service app to room
  console.log('\n=== STEP 2: Add Service App to Room ===\n');
  const membershipPayload = {
    roomId: roomId,
    personId: meData.id
  };
  
  const membershipResponse = await fetch('https://webexapis.com/v1/memberships', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${botToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(membershipPayload)
  });
  
  console.log('Membership Status:', membershipResponse.status);
  if (membershipResponse.ok) {
    const membershipData = await membershipResponse.json();
    console.log('Membership Created:', membershipData.id);
  } else {
    const errorText = await membershipResponse.text();
    console.log('Membership Error:', errorText);
  }
  
  // Step 3: Create webhook
  console.log('\n=== STEP 3: Create Webhook ===\n');
  const webhookPayload = {
    name: `PracticeTools Messages - ${roomTitle}`,
    targetUrl: 'https://czpifmw72k.us-east-1.awsapprunner.com/api/webhooks/webexmessaging/messages',
    resource: 'messages',
    event: 'created',
    filter: `roomId=${roomId}`
  };
  
  const webhookResponse = await fetch('https://webexapis.com/v1/webhooks', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(webhookPayload)
  });
  
  console.log('Webhook Status:', webhookResponse.status);
  if (webhookResponse.ok) {
    const webhookData = await webhookResponse.json();
    console.log('Webhook Created:', webhookData.id);
    console.log('Webhook Name:', webhookData.name);
  } else {
    const errorText = await webhookResponse.text();
    console.log('Webhook Error:', errorText);
  }
}

main().catch(console.error);
