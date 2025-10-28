import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function getAccessToken() {
  const client = new SSMClient({ region: 'us-east-1' });
  const command = new GetParameterCommand({
    Name: '/PracticeTools/dev/NETSYNC_WEBEX_MEETINGS_ACCESS_TOKEN',
    WithDecryption: true
  });
  const response = await client.send(command);
  return response.Parameter.Value;
}

async function checkWebhookDetails() {
  const accessToken = await getAccessToken();
  
  const response = await fetch('https://webexapis.com/v1/webhooks', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  const data = await response.json();
  
  console.log('\n=== WEBEX WEBHOOK DETAILS ===\n');
  
  const transcriptWebhook = data.items.find(w => w.resource === 'meetingTranscripts');
  
  if (transcriptWebhook) {
    console.log('✅ Transcript Webhook Found:\n');
    console.log('  ID:', transcriptWebhook.id);
    console.log('  Name:', transcriptWebhook.name);
    console.log('  Status:', transcriptWebhook.status);
    console.log('  Resource:', transcriptWebhook.resource);
    console.log('  Event:', transcriptWebhook.event);
    console.log('  Target URL:', transcriptWebhook.targetUrl);
    console.log('  Created:', transcriptWebhook.created);
    console.log('  Owned By:', transcriptWebhook.ownedBy);
    
    // Test the webhook
    console.log('\n=== TESTING WEBHOOK ===\n');
    const testResponse = await fetch(`https://webexapis.com/v1/webhooks/${transcriptWebhook.id}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (testResponse.ok) {
      const details = await testResponse.json();
      console.log('✅ Webhook is accessible');
      console.log('  Secret defined:', !!details.secret);
      console.log('  Filter:', details.filter || 'none');
    }
  } else {
    console.log('❌ No transcript webhook found');
  }
  
  console.log('\n=== RECOMMENDATIONS ===\n');
  console.log('1. Verify transcription is enabled in Webex Meetings settings');
  console.log('2. Check if the integration has "meeting:transcript_read" scope');
  console.log('3. Ensure meetings have transcription enabled when scheduled');
  console.log('4. Test with a new meeting that has transcription explicitly enabled');
}

checkWebhookDetails().catch(console.error);
