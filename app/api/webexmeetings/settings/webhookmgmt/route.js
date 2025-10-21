import { NextResponse } from 'next/server';
import { getTableName } from '../../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { getSecureParameter } from '../../../../../lib/ssm-config';
import { getEnvironment } from '../../../../../lib/dynamodb';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function getWebexMeetingsConfig() {
  const tableName = getTableName('Settings');
  console.log('🔧 [WEBHOOK-MGMT] Loading config from table:', tableName);
  const command = new GetCommand({
    TableName: tableName,
    Key: { setting_key: 'webex-meetings' }
  });
  const result = await docClient.send(command);
  console.log('🔧 [WEBHOOK-MGMT] Raw config result:', result.Item);
  const config = result.Item?.setting_value ? JSON.parse(result.Item.setting_value) : null;
  console.log('🔧 [WEBHOOK-MGMT] Parsed config:', config);
  return config;
}

async function saveWebexMeetingsConfig(config) {
  const tableName = getTableName('Settings');
  console.log('🔧 [WEBHOOK-MGMT] Saving config to table:', tableName);
  console.log('🔧 [WEBHOOK-MGMT] Config to save:', JSON.stringify(config, null, 2));
  const command = new PutCommand({
    TableName: tableName,
    Item: {
      setting_key: 'webex-meetings',
      setting_value: JSON.stringify(config),
      updated_at: new Date().toISOString()
    }
  });
  const result = await docClient.send(command);
  console.log('🔧 [WEBHOOK-MGMT] Save result:', result);
}

export async function POST(request) {
  try {
    console.log('🔧 [WEBHOOK-MGMT] Webhook management request received');
    console.log('🔧 [WEBHOOK-MGMT] Request headers:', Object.fromEntries(request.headers.entries()));
    
    let action;
    try {
      const body = await request.json();
      action = body.action;
      console.log('🔧 [WEBHOOK-MGMT] Action:', action);
      console.log('🔧 [WEBHOOK-MGMT] Full request body:', JSON.stringify(body, null, 2));
    } catch (jsonError) {
      console.error('🔧 [WEBHOOK-MGMT] JSON parsing error:', jsonError);
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    
    let config;
    try {
      config = await getWebexMeetingsConfig();
      console.log('🔧 [WEBHOOK-MGMT] Config loaded:', !!config);
      console.log('🔧 [WEBHOOK-MGMT] Config details:', {
        enabled: config?.enabled,
        sitesCount: config?.sites?.length,
        sites: config?.sites?.map(s => ({ siteUrl: s.siteUrl, hasAccessToken: !!s.accessToken, recordingHostsCount: s.recordingHosts?.length }))
      });
    } catch (configError) {
      console.error('🔧 [WEBHOOK-MGMT] Config loading error:', configError);
      return NextResponse.json({ error: 'Failed to load WebEx configuration' }, { status: 500 });
    }
    
    if (!config?.enabled || !config.sites?.length) {
      console.warn('🔧 [WEBHOOK-MGMT] WebexMeetings not configured or disabled');
      return NextResponse.json({ error: 'WebexMeetings not configured' }, { status: 400 });
    }

    const baseUrl = process.env.NEXTAUTH_URL || `https://${request.headers.get('host')}`;
    console.log('🔧 [WEBHOOK-MGMT] Base URL for webhooks:', baseUrl);
    const results = [];

    console.log('🔧 [WEBHOOK-MGMT] Processing sites:', config.sites?.length || 0);
    
    for (const site of config.sites) {
      console.log('🔧 [WEBHOOK-MGMT] Processing site:', site.siteUrl);
      
      // Get tokens from SSM using correct naming pattern
      const env = getEnvironment();
      const siteName = site.siteUrl.split('.')[0].toUpperCase(); // Extract first part before first dot
      const basePath = env === 'prod' ? '/PracticeTools' : '/PracticeTools/dev';
      const accessTokenParam = `${basePath}/${siteName}_WEBEX_MEETINGS_ACCESS_TOKEN`;
      const refreshTokenParam = `${basePath}/${siteName}_WEBEX_MEETINGS_REFRESH_TOKEN`;
      
      console.log('🔧 [WEBHOOK-MGMT] Loading tokens from SSM:', {
        siteName,
        env,
        basePath,
        accessTokenParam,
        refreshTokenParam
      });
      
      const accessToken = await getSecureParameter(accessTokenParam);
      const refreshToken = await getSecureParameter(refreshTokenParam);
      
      console.log('🔧 [WEBHOOK-MGMT] Site details:', {
        siteUrl: site.siteUrl,
        siteName: site.siteName,
        hasAccessToken: !!accessToken,
        accessTokenLength: accessToken?.length,
        hasRefreshToken: !!refreshToken,
        recordingHosts: site.recordingHosts,
        existingRecordingsWebhookId: site.recordingsWebhookId,
        existingTranscriptsWebhookId: site.transcriptsWebhookId
      });
      
      if (!accessToken) {
        console.error('🔧 [WEBHOOK-MGMT] No access token found in SSM for:', site.siteUrl);
        results.push({ site: site.siteName || site.siteUrl, status: 'error', error: `Access token not found in SSM: ${accessTokenParam}` });
        continue;
      }
      
      if (!refreshToken) {
        console.warn('🔧 [WEBHOOK-MGMT] No refresh token found in SSM for:', site.siteUrl);
        console.warn('🔧 [WEBHOOK-MGMT] Refresh token parameter:', refreshTokenParam);
      }
      
      console.log('🔧 [WEBHOOK-MGMT] Successfully loaded tokens from SSM for:', site.siteUrl);
      
      if (action === 'create') {
        console.log('🔧 [WEBHOOK-MGMT] Creating webhooks for:', site.siteUrl);
        
        const recordingsPayload = {
          name: `PracticeTools Recordings - ${site.siteName || site.siteUrl}`,
          targetUrl: `${baseUrl}/api/webhooks/webexmeetings/recordings`,
          resource: 'recordings',
          event: 'created'
        };
        console.log('🔧 [WEBHOOK-MGMT] Recordings webhook payload:', recordingsPayload);
        
        const recordingsWebhook = await fetch('https://webexapis.com/v1/webhooks', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(recordingsPayload)
        });

        const transcriptsPayload = {
          name: `PracticeTools Transcripts - ${site.siteName || site.siteUrl}`,
          targetUrl: `${baseUrl}/api/webhooks/webexmeetings/transcripts`,
          resource: 'meetingTranscripts',
          event: 'created'
        };
        console.log('🔧 [WEBHOOK-MGMT] Transcripts webhook payload:', transcriptsPayload);
        
        const transcriptsWebhook = await fetch('https://webexapis.com/v1/webhooks', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(transcriptsPayload)
        });

        console.log('🔧 [WEBHOOK-MGMT] Recordings webhook status:', recordingsWebhook.status);
        console.log('🔧 [WEBHOOK-MGMT] Recordings webhook headers:', Object.fromEntries(recordingsWebhook.headers.entries()));
        console.log('🔧 [WEBHOOK-MGMT] Transcripts webhook status:', transcriptsWebhook.status);
        console.log('🔧 [WEBHOOK-MGMT] Transcripts webhook headers:', Object.fromEntries(transcriptsWebhook.headers.entries()));
        
        const recordingsResult = await recordingsWebhook.json();
        const transcriptsResult = await transcriptsWebhook.json();
        
        console.log('🔧 [WEBHOOK-MGMT] Recordings result:', JSON.stringify(recordingsResult, null, 2));
        console.log('🔧 [WEBHOOK-MGMT] Transcripts result:', JSON.stringify(transcriptsResult, null, 2));

        if (recordingsWebhook.ok && transcriptsWebhook.ok) {
          console.log('🔧 [WEBHOOK-MGMT] Both webhooks created successfully for:', site.siteUrl);
          site.recordingsWebhookId = recordingsResult.id;
          site.transcriptsWebhookId = transcriptsResult.id;
          console.log('🔧 [WEBHOOK-MGMT] Assigned webhook IDs:', {
            recordingsWebhookId: recordingsResult.id,
            transcriptsWebhookId: transcriptsResult.id
          });
          results.push({ site: site.siteName || site.siteUrl, status: 'created' });
        } else {
          const errorMsg = recordingsResult.message || transcriptsResult.message || 'Unknown error';
          console.error('🔧 [WEBHOOK-MGMT] Webhook creation failed for', site.siteUrl, ':', {
            recordingsOk: recordingsWebhook.ok,
            transcriptsOk: transcriptsWebhook.ok,
            recordingsError: recordingsResult,
            transcriptsError: transcriptsResult,
            errorMsg
          });
          results.push({ site: site.siteName || site.siteUrl, status: 'error', error: errorMsg });
        }

      } else if (action === 'delete') {
        console.log('🔧 [WEBHOOK-MGMT] Deleting webhooks for:', site.siteUrl);
        const deleteResults = [];
        
        if (site.recordingsWebhookId) {
          console.log('🔧 [WEBHOOK-MGMT] Deleting recordings webhook:', site.recordingsWebhookId);
          const deleteRecordings = await fetch(`https://webexapis.com/v1/webhooks/${site.recordingsWebhookId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          console.log('🔧 [WEBHOOK-MGMT] Delete recordings response:', deleteRecordings.status);
          deleteResults.push(deleteRecordings.ok);
        }

        if (site.transcriptsWebhookId) {
          console.log('🔧 [WEBHOOK-MGMT] Deleting transcripts webhook:', site.transcriptsWebhookId);
          const deleteTranscripts = await fetch(`https://webexapis.com/v1/webhooks/${site.transcriptsWebhookId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          console.log('🔧 [WEBHOOK-MGMT] Delete transcripts response:', deleteTranscripts.status);
          deleteResults.push(deleteTranscripts.ok);
        }

        console.log('🔧 [WEBHOOK-MGMT] Delete results:', deleteResults);
        if (deleteResults.every(r => r)) {
          delete site.recordingsWebhookId;
          delete site.transcriptsWebhookId;
          console.log('🔧 [WEBHOOK-MGMT] Successfully deleted all webhooks for:', site.siteUrl);
          results.push({ site: site.siteName || site.siteUrl, status: 'deleted' });
        } else {
          console.error('🔧 [WEBHOOK-MGMT] Failed to delete some webhooks for:', site.siteUrl);
          results.push({ site: site.siteName || site.siteUrl, status: 'error' });
        }

      } else if (action === 'validate') {
        console.log('🔧 [WEBHOOK-MGMT] Validating webhooks for:', site.siteUrl);
        const validationResults = [];

        if (site.recordingsWebhookId) {
          console.log('🔧 [WEBHOOK-MGMT] Validating recordings webhook:', site.recordingsWebhookId);
          const validateRecordings = await fetch(`https://webexapis.com/v1/webhooks/${site.recordingsWebhookId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          console.log('🔧 [WEBHOOK-MGMT] Recordings validation response:', validateRecordings.status);
          if (validateRecordings.ok) {
            const recordingsData = await validateRecordings.json();
            console.log('🔧 [WEBHOOK-MGMT] Recordings webhook data:', recordingsData);
          }
          validationResults.push(validateRecordings.ok);
        }

        if (site.transcriptsWebhookId) {
          console.log('🔧 [WEBHOOK-MGMT] Validating transcripts webhook:', site.transcriptsWebhookId);
          const validateTranscripts = await fetch(`https://webexapis.com/v1/webhooks/${site.transcriptsWebhookId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          console.log('🔧 [WEBHOOK-MGMT] Transcripts validation response:', validateTranscripts.status);
          if (validateTranscripts.ok) {
            const transcriptsData = await validateTranscripts.json();
            console.log('🔧 [WEBHOOK-MGMT] Transcripts webhook data:', transcriptsData);
          }
          validationResults.push(validateTranscripts.ok);
        }

        const hasWebhooks = !!(site.recordingsWebhookId || site.transcriptsWebhookId);
        const isValid = validationResults.every(r => r);
        console.log('🔧 [WEBHOOK-MGMT] Validation results for', site.siteUrl, ':', {
          validationResults,
          hasWebhooks,
          isValid
        });
        
        results.push({ 
          site: site.siteName || site.siteUrl, 
          status: isValid ? 'valid' : 'invalid',
          hasWebhooks
        });
      }
    }

    console.log('🔧 [WEBHOOK-MGMT] Final results:', JSON.stringify(results, null, 2));
    console.log('🔧 [WEBHOOK-MGMT] Saving updated config...');
    console.log('🔧 [WEBHOOK-MGMT] Config to save:', JSON.stringify(config, null, 2));
    await saveWebexMeetingsConfig(config);
    console.log('🔧 [WEBHOOK-MGMT] Config saved successfully');
    console.log('🔧 [WEBHOOK-MGMT] Returning results to frontend');
    return NextResponse.json({ results });
  } catch (error) {
    console.error('🔧 [WEBHOOK-MGMT] Webhook management error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause
    });
    console.error('🔧 [WEBHOOK-MGMT] Full error object:', error);
    return NextResponse.json({ 
      error: 'Operation failed', 
      details: error.message 
    }, { status: 500 });
  }
}