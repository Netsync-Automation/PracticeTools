import { NextResponse } from 'next/server';
import { getTableName } from '../../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function getWebexMeetingsConfig() {
  const tableName = getTableName('Settings');
  const command = new GetCommand({
    TableName: tableName,
    Key: { id: 'webex-meetings' }
  });
  const result = await docClient.send(command);
  return result.Item;
}

async function saveWebexMeetingsConfig(config) {
  const tableName = getTableName('Settings');
  const command = new PutCommand({
    TableName: tableName,
    Item: { ...config, id: 'webex-meetings', updated_at: new Date().toISOString() }
  });
  await docClient.send(command);
}

export async function POST(request) {
  try {
    const { action } = await request.json();
    const config = await getWebexMeetingsConfig();
    
    if (!config?.enabled || !config.sites?.length) {
      return NextResponse.json({ error: 'WebexMeetings not configured' }, { status: 400 });
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'https://your-domain.com';
    const results = [];

    for (const site of config.sites) {
      if (action === 'create') {
        const recordingsWebhook = await fetch('https://webexapis.com/v1/webhooks', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${site.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: `PracticeTools Recordings - ${site.siteName}`,
            targetUrl: `${baseUrl}/api/webhooks/webexmeetings/recordings`,
            resource: 'recordings',
            event: 'created'
          })
        });

        const transcriptsWebhook = await fetch('https://webexapis.com/v1/webhooks', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${site.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: `PracticeTools Transcripts - ${site.siteName}`,
            targetUrl: `${baseUrl}/api/webhooks/webexmeetings/transcripts`,
            resource: 'meetingTranscripts',
            event: 'created'
          })
        });

        const recordingsResult = await recordingsWebhook.json();
        const transcriptsResult = await transcriptsWebhook.json();

        if (recordingsWebhook.ok && transcriptsWebhook.ok) {
          site.recordingsWebhookId = recordingsResult.id;
          site.transcriptsWebhookId = transcriptsResult.id;
          results.push({ site: site.siteName, status: 'created' });
        } else {
          results.push({ site: site.siteName, status: 'error', error: recordingsResult.message || transcriptsResult.message });
        }

      } else if (action === 'delete') {
        const deleteResults = [];
        
        if (site.recordingsWebhookId) {
          const deleteRecordings = await fetch(`https://webexapis.com/v1/webhooks/${site.recordingsWebhookId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${site.accessToken}` }
          });
          deleteResults.push(deleteRecordings.ok);
        }

        if (site.transcriptsWebhookId) {
          const deleteTranscripts = await fetch(`https://webexapis.com/v1/webhooks/${site.transcriptsWebhookId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${site.accessToken}` }
          });
          deleteResults.push(deleteTranscripts.ok);
        }

        if (deleteResults.every(r => r)) {
          delete site.recordingsWebhookId;
          delete site.transcriptsWebhookId;
          results.push({ site: site.siteName, status: 'deleted' });
        } else {
          results.push({ site: site.siteName, status: 'error' });
        }

      } else if (action === 'validate') {
        const validationResults = [];

        if (site.recordingsWebhookId) {
          const validateRecordings = await fetch(`https://webexapis.com/v1/webhooks/${site.recordingsWebhookId}`, {
            headers: { 'Authorization': `Bearer ${site.accessToken}` }
          });
          validationResults.push(validateRecordings.ok);
        }

        if (site.transcriptsWebhookId) {
          const validateTranscripts = await fetch(`https://webexapis.com/v1/webhooks/${site.transcriptsWebhookId}`, {
            headers: { 'Authorization': `Bearer ${site.accessToken}` }
          });
          validationResults.push(validateTranscripts.ok);
        }

        results.push({ 
          site: site.siteName, 
          status: validationResults.every(r => r) ? 'valid' : 'invalid',
          hasWebhooks: !!(site.recordingsWebhookId || site.transcriptsWebhookId)
        });
      }
    }

    await saveWebexMeetingsConfig(config);
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Webhook management error:', error);
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
  }
}