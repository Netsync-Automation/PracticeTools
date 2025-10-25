import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { getTableName, getEnvironment } from './lib/dynamodb.js';
import { getSecureParameter } from './lib/ssm-config.js';

process.env.ENVIRONMENT = 'dev';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function troubleshootWebhooks() {
  // Get config
  const tableName = getTableName('Settings');
  const getCommand = new GetCommand({
    TableName: tableName,
    Key: { setting_key: 'webex-meetings' }
  });
  
  const result = await docClient.send(getCommand);
  const config = result.Item?.setting_value ? JSON.parse(result.Item.setting_value) : null;
  
  if (!config?.sites?.length) {
    console.log('No sites configured');
    return;
  }
  
  const site = config.sites[0];
  const accessToken = await getSecureParameter('/PracticeTools/dev/NETSYNC_WEBEX_MEETINGS_ACCESS_TOKEN');
  const baseUrl = 'https://czpifmw72k.us-east-1.awsapprunner.com';
  
  console.log('=== DELETING EXISTING WEBHOOKS ===');
  
  // Delete existing webhooks
  if (site.recordingWebhookId) {
    console.log('Deleting recording webhook:', site.recordingWebhookId);
    const deleteRecording = await fetch(`https://webexapis.com/v1/webhooks/${site.recordingWebhookId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    console.log('Recording webhook delete status:', deleteRecording.status);
  }
  
  if (site.transcriptWebhookId) {
    console.log('Deleting transcript webhook:', site.transcriptWebhookId);
    const deleteTranscript = await fetch(`https://webexapis.com/v1/webhooks/${site.transcriptWebhookId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    console.log('Transcript webhook delete status:', deleteTranscript.status);
  }
  
  console.log('\n=== CREATING NEW WEBHOOKS ===');
  
  // Create recording webhook
  const recordingsPayload = {
    name: `PracticeTools Recordings - ${site.siteName || site.siteUrl}`,
    targetUrl: `${baseUrl}/api/webhooks/webexmeetings/recordings`,
    resource: 'recordings',
    event: 'created',
    ownedBy: 'org',
    siteUrl: site.siteUrl
  };
  
  console.log('Recording webhook payload:', JSON.stringify(recordingsPayload, null, 2));
  
  const recordingResponse = await fetch('https://webexapis.com/v1/webhooks', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(recordingsPayload)
  });
  
  console.log('Recording webhook response status:', recordingResponse.status);
  const recordingResult = await recordingResponse.json();
  console.log('Recording webhook result:', JSON.stringify(recordingResult, null, 2));
  
  // Create transcript webhook
  const transcriptsPayload = {
    name: `PracticeTools Transcripts - ${site.siteName || site.siteUrl}`,
    targetUrl: `${baseUrl}/api/webhooks/webexmeetings/transcripts`,
    resource: 'meetingTranscripts',
    event: 'created',
    ownedBy: 'org',
    siteUrl: site.siteUrl
  };
  
  console.log('\nTranscript webhook payload:', JSON.stringify(transcriptsPayload, null, 2));
  
  const transcriptResponse = await fetch('https://webexapis.com/v1/webhooks', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(transcriptsPayload)
  });
  
  console.log('Transcript webhook response status:', transcriptResponse.status);
  const transcriptResult = await transcriptResponse.json();
  console.log('Transcript webhook result:', JSON.stringify(transcriptResult, null, 2));
  
  // Update config with new webhook IDs
  if (recordingResponse.ok && transcriptResponse.ok) {
    site.recordingWebhookId = recordingResult.id;
    site.transcriptWebhookId = transcriptResult.id;
    
    const putCommand = new PutCommand({
      TableName: tableName,
      Item: {
        setting_key: 'webex-meetings',
        setting_value: JSON.stringify(config),
        updated_at: new Date().toISOString()
      }
    });
    
    await docClient.send(putCommand);
    console.log('\n✅ Updated config with new webhook IDs');
  }
}

troubleshootWebhooks().catch(console.error);