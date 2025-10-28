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

async function listWebhooks() {
  let accessToken;
  
  try {
    accessToken = await getAccessToken();
  } catch (error) {
    console.error('Failed to fetch access token from SSM:', error.message);
    return;
  }

  try {
    const response = await fetch('https://webexapis.com/v1/webhooks', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch webhooks:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return;
    }

    const data = await response.json();
    
    console.log('\n=== WEBEX WEBHOOKS ===\n');
    
    if (!data.items || data.items.length === 0) {
      console.log('No webhooks found.');
      return;
    }

    data.items.forEach((webhook, index) => {
      console.log(`Webhook #${index + 1}:`);
      console.log(`  ID: ${webhook.id}`);
      console.log(`  Name: ${webhook.name}`);
      console.log(`  Target URL: ${webhook.targetUrl}`);
      console.log(`  Resource: ${webhook.resource}`);
      console.log(`  Event: ${webhook.event}`);
      console.log(`  Status: ${webhook.status}`);
      console.log(`  Created: ${webhook.created}`);
      console.log('---\n');
    });

    console.log(`Total webhooks: ${data.items.length}\n`);

  } catch (error) {
    console.error('Error listing webhooks:', error.message);
  }
}

listWebhooks().catch(console.error);
