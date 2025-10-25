import { getSecureParameter } from './lib/ssm-config.js';

process.env.ENVIRONMENT = 'dev';

async function investigatePhantomWebhook() {
  const accessToken = await getSecureParameter('/PracticeTools/dev/NETSYNC_WEBEX_MEETINGS_ACCESS_TOKEN');
  
  console.log('=== INVESTIGATING PHANTOM WEBHOOK ===');
  
  // 1. List all webhooks with different parameters
  console.log('\n1. Listing all webhooks (default)');
  let response = await fetch('https://webexapis.com/v1/webhooks', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  let data = await response.json();
  console.log(`Found ${data.items?.length || 0} webhooks`);
  
  // 2. Try with max parameter
  console.log('\n2. Listing webhooks with max=100');
  response = await fetch('https://webexapis.com/v1/webhooks?max=100', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  data = await response.json();
  console.log(`Found ${data.items?.length || 0} webhooks`);
  
  // 3. Try to get webhooks by specific resource
  console.log('\n3. Checking for meetingTranscripts webhooks specifically');
  if (data.items) {
    const transcriptWebhooks = data.items.filter(w => w.resource === 'meetingTranscripts');
    console.log(`Transcript webhooks: ${transcriptWebhooks.length}`);
    transcriptWebhooks.forEach(w => {
      console.log(`- ${w.name} (${w.id}): ${w.ownedBy}, status: ${w.status}`);
    });
  }
  
  // 4. Check our database configuration to see if there are stored webhook IDs
  console.log('\n4. Checking database configuration');
  const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, GetCommand } = await import('@aws-sdk/lib-dynamodb');
  const { getTableName } = await import('./lib/dynamodb.js');
  
  const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
  const docClient = DynamoDBDocumentClient.from(dynamoClient);
  
  const tableName = getTableName('Settings');
  const getCommand = new GetCommand({
    TableName: tableName,
    Key: { setting_key: 'webex-meetings' }
  });
  
  const dbResult = await docClient.send(getCommand);
  const config = dbResult.Item?.setting_value ? JSON.parse(dbResult.Item.setting_value) : null;
  
  if (config?.sites?.length) {
    const site = config.sites[0];
    console.log('Database webhook IDs:');
    console.log(`- Recording: ${site.recordingWebhookId || 'none'}`);
    console.log(`- Transcript: ${site.transcriptWebhookId || 'none'}`);
    
    // 5. Try to get these specific webhooks by ID
    if (site.transcriptWebhookId) {
      console.log('\n5. Checking stored transcript webhook ID');
      const webhookResponse = await fetch(`https://webexapis.com/v1/webhooks/${site.transcriptWebhookId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      console.log(`Webhook ${site.transcriptWebhookId} status: ${webhookResponse.status}`);
      if (webhookResponse.ok) {
        const webhook = await webhookResponse.json();
        console.log(`Found webhook: ${webhook.name}, ownedBy: ${webhook.ownedBy}, status: ${webhook.status}`);
      } else {
        const error = await webhookResponse.text();
        console.log(`Error: ${error}`);
      }
    }
  }
  
  // 6. Try creating a simple org webhook to see the exact error
  console.log('\n6. Testing org webhook creation to see exact error');
  const testPayload = {
    name: 'Test Org Webhook',
    targetUrl: 'https://czpifmw72k.us-east-1.awsapprunner.com/api/webhooks/test',
    resource: 'meetingTranscripts',
    event: 'created',
    ownedBy: 'org'
  };
  
  const testResponse = await fetch('https://webexapis.com/v1/webhooks', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(testPayload)
  });
  
  console.log(`Test org webhook status: ${testResponse.status}`);
  const testResult = await testResponse.text();
  console.log(`Test result: ${testResult}`);
}

investigatePhantomWebhook().catch(console.error);