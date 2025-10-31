import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const ssmClient = new SSMClient({ region: 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function getToken() {
  const result = await ssmClient.send(new GetParameterCommand({
    Name: '/PracticeTools/dev/NETSYNC_WEBEX_MEETINGS_ACCESS_TOKEN'
  }));
  return result.Parameter.Value;
}

async function getConfig() {
  const command = new GetCommand({
    TableName: 'PracticeTools-dev-Settings',
    Key: { setting_key: 'webex-meetings' }
  });
  const result = await docClient.send(command);
  return result.Item?.setting_value ? JSON.parse(result.Item.setting_value) : null;
}

async function main() {
  const token = await getToken();
  const config = await getConfig();
  
  console.log('\n=== MONITORED ROOMS IN DATABASE ===\n');
  const site = config.sites[0];
  console.log('Site:', site.siteUrl);
  console.log('Monitored Rooms:', site.monitoredRooms?.length || 0);
  site.monitoredRooms?.forEach((room, i) => {
    console.log(`  [${i + 1}] ${room.title}`);
    console.log(`      ID: ${room.id}`);
  });
  
  console.log('\n=== WEBHOOKS IN WEBEX ===\n');
  const response = await fetch('https://webexapis.com/v1/webhooks', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const data = await response.json();
  const allWebhooks = data.items || [];
  
  console.log(`Total webhooks: ${allWebhooks.length}\n`);
  
  allWebhooks.forEach((webhook, i) => {
    console.log(`[${i + 1}] ${webhook.name}`);
    console.log(`    ID: ${webhook.id}`);
    console.log(`    Resource: ${webhook.resource}`);
    console.log(`    Event: ${webhook.event}`);
    console.log(`    Target URL: ${webhook.targetUrl}`);
    console.log(`    Filter: ${webhook.filter || 'none'}`);
    console.log(`    Status: ${webhook.status}`);
    console.log(`    Created: ${webhook.created}`);
    console.log('');
  });
  
  const messagingWebhooks = allWebhooks.filter(w => w.resource === 'messages');
  const recordingsWebhooks = allWebhooks.filter(w => w.resource === 'recordings');
  
  console.log(`\nSummary:`);
  console.log(`  Recordings webhooks: ${recordingsWebhooks.length}`);
  console.log(`  Messaging webhooks: ${messagingWebhooks.length}`);
  
  console.log('\n=== STORED WEBHOOK IDS IN DATABASE ===\n');
  console.log('recordingWebhookId:', site.recordingWebhookId);
  console.log('messagingWebhookIds:', JSON.stringify(site.messagingWebhookIds, null, 2));
}

main().catch(console.error);
