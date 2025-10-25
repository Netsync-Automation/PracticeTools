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
    // Validate request origin and method
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const expectedOrigin = process.env.NEXTAUTH_URL;
    
    if (origin && expectedOrigin && !origin.includes(expectedOrigin.replace(/https?:\/\//, ''))) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    }
    
    let action;
    try {
      const body = await request.json();
      action = body.action?.trim();
      
      // Validate action parameter
      if (!action || !['create', 'delete', 'validate'].includes(action)) {
        return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 });
      }
    } catch (jsonError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    
    let config;
    try {
      config = await getWebexMeetingsConfig();
      if (!config) {
        return NextResponse.json({ error: 'WebEx configuration not found' }, { status: 404 });
      }
    } catch (configError) {
      console.error('🔧 [WEBHOOK-MGMT] Config loading error:', configError.message);
      return NextResponse.json({ error: 'Failed to load WebEx configuration' }, { status: 500 });
    }
    
    if (!config?.enabled || !config.sites?.length) {
      console.warn('🔧 [WEBHOOK-MGMT] WebexMeetings not configured or disabled');
      return NextResponse.json({ error: 'WebexMeetings not configured' }, { status: 400 });
    }

    // Get NEXTAUTH_URL from SSM
    const nextAuthUrl = await getSecureParameter(
      getEnvironment() === 'prod' ? '/PracticeTools/NEXTAUTH_URL' : '/PracticeTools/dev/NEXTAUTH_URL'
    );
    const baseUrl = nextAuthUrl || process.env.NEXTAUTH_URL || `https://${request.headers.get('host')}`;
    console.log('🔧 [WEBHOOK-MGMT] Base URL for webhooks:', baseUrl);
    const results = [];

    console.log('🔧 [WEBHOOK-MGMT] Processing sites:', config.sites?.length || 0);
    
    for (const site of config.sites) {
      console.log('🔧 [WEBHOOK-MGMT] Processing site:', site.siteUrl);
      
      // Get tokens from SSM using correct naming pattern
      const env = getEnvironment();
      const siteName = site.siteUrl.replace(/^https?:\/\//, '').split('.')[0].toUpperCase(); // Extract first part before first dot
      const accessTokenParam = env === 'prod' 
        ? `/PracticeTools/${siteName}_WEBEX_MEETINGS_ACCESS_TOKEN`
        : `/PracticeTools/dev/${siteName}_WEBEX_MEETINGS_ACCESS_TOKEN`;
      const refreshTokenParam = env === 'prod'
        ? `/PracticeTools/${siteName}_WEBEX_MEETINGS_REFRESH_TOKEN`
        : `/PracticeTools/dev/${siteName}_WEBEX_MEETINGS_REFRESH_TOKEN`;
      
      console.log('🔧 [WEBHOOK-MGMT] Loading tokens from SSM:', {
        siteName,
        env,
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
        existingRecordingWebhookId: site.recordingWebhookId,
        existingTranscriptWebhookId: site.transcriptWebhookId
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
        
        // Create webhooks for Webex Meetings with org ownership and site URL
        const recordingsPayload = {
          name: `PracticeTools Recordings - ${site.siteName || site.siteUrl}`,
          targetUrl: `${baseUrl}/api/webhooks/webexmeetings/recordings`,
          resource: 'recordings',
          event: 'created',
          ownedBy: 'creator'
        };
        console.log('🔧 [WEBHOOK-MGMT] Recordings webhook payload:', recordingsPayload);
        
        let recordingsWebhook, transcriptsWebhook;
        try {
          console.log('🔧 [WEBHOOK-MGMT] Creating recordings webhook with payload:', JSON.stringify(recordingsPayload, null, 2));
          recordingsWebhook = await fetch('https://webexapis.com/v1/webhooks', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(recordingsPayload)
          });
          console.log('🔧 [WEBHOOK-MGMT] Recordings webhook response status:', recordingsWebhook.status);
        } catch (fetchError) {
          console.error('🔧 [WEBHOOK-MGMT] Network error creating recordings webhook:', fetchError);
          results.push({ site: site.siteName || site.siteUrl, status: 'error', error: `Network error creating recordings webhook: ${fetchError.message}` });
          continue;
        }

        const transcriptsPayload = {
          name: `PracticeTools Transcripts - ${site.siteName || site.siteUrl}`,
          targetUrl: `${baseUrl}/api/webhooks/webexmeetings/transcripts`,
          resource: 'meetingTranscripts',
          event: 'created',
          ownedBy: 'creator'
        };
        
        try {
          console.log('🔧 [WEBHOOK-MGMT] Creating transcripts webhook with payload:', JSON.stringify(transcriptsPayload, null, 2));
          console.log('🔧 [WEBHOOK-MGMT] Request headers:', {
            'Authorization': `Bearer ${accessToken.substring(0, 20)}...`,
            'Content-Type': 'application/json'
          });
          transcriptsWebhook = await fetch('https://webexapis.com/v1/webhooks', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(transcriptsPayload)
          });
          console.log('🔧 [WEBHOOK-MGMT] Transcripts webhook response status:', transcriptsWebhook.status);
          console.log('🔧 [WEBHOOK-MGMT] Transcripts webhook response headers:', Object.fromEntries(transcriptsWebhook.headers.entries()));
        } catch (fetchError) {
          console.error('🔧 [WEBHOOK-MGMT] Network error creating transcripts webhook:', fetchError);
          results.push({ site: site.siteName || site.siteUrl, status: 'error', error: `Network error creating transcripts webhook: ${fetchError.message}` });
          continue;
        }

        console.log('🔧 [WEBHOOK-MGMT] Recordings webhook status:', recordingsWebhook.status);
        console.log('🔧 [WEBHOOK-MGMT] Recordings webhook headers:', Object.fromEntries(recordingsWebhook.headers.entries()));
        console.log('🔧 [WEBHOOK-MGMT] Transcripts webhook status:', transcriptsWebhook.status);
        console.log('🔧 [WEBHOOK-MGMT] Transcripts webhook headers:', Object.fromEntries(transcriptsWebhook.headers.entries()));
        
        let recordingsResult, transcriptsResult;
        try {
          recordingsResult = await recordingsWebhook.json();
          transcriptsResult = await transcriptsWebhook.json();
        } catch (parseError) {
          console.error('🔧 [WEBHOOK-MGMT] Error parsing webhook responses:', parseError);
          results.push({ site: site.siteName || site.siteUrl, status: 'error', error: `Failed to parse webhook response: ${parseError.message}` });
          continue;
        }
        
        console.log('🔧 [WEBHOOK-MGMT] Recordings result:', JSON.stringify(recordingsResult, null, 2));
        console.log('🔧 [WEBHOOK-MGMT] Transcripts result:', JSON.stringify(transcriptsResult, null, 2));

        if (recordingsWebhook.ok && transcriptsWebhook.ok) {
          console.log('🔧 [WEBHOOK-MGMT] Both webhooks created successfully for:', site.siteUrl);
          site.recordingWebhookId = recordingsResult.id;
          site.transcriptWebhookId = transcriptsResult.id;
          console.log('🔧 [WEBHOOK-MGMT] Assigned webhook IDs:', {
            recordingWebhookId: recordingsResult.id,
            transcriptWebhookId: transcriptsResult.id
          });
          results.push({ 
            site: site.siteName || site.siteUrl, 
            status: 'created',
            recordingWebhookId: recordingsResult.id,
            transcriptWebhookId: transcriptsResult.id
          });
        } else {
          const recordingsError = !recordingsWebhook.ok ? (recordingsResult.message || recordingsResult.errors?.[0]?.description || `HTTP ${recordingsWebhook.status}`) : null;
          const transcriptsError = !transcriptsWebhook.ok ? (transcriptsResult.message || transcriptsResult.errors?.[0]?.description || `HTTP ${transcriptsWebhook.status}`) : null;
          const errorMsg = recordingsError || transcriptsError || 'Unknown error';
          
          console.error('🔧 [WEBHOOK-MGMT] Webhook creation failed for', site.siteUrl, ':', {
            recordingsOk: recordingsWebhook.ok,
            transcriptsOk: transcriptsWebhook.ok,
            recordingsError,
            transcriptsError,
            recordingsResult,
            transcriptsResult
          });
          results.push({ 
            site: site.siteName || site.siteUrl, 
            status: 'error', 
            error: errorMsg,
            details: {
              recordings: { ok: recordingsWebhook.ok, error: recordingsError },
              transcripts: { ok: transcriptsWebhook.ok, error: transcriptsError }
            }
          });
        }

      } else if (action === 'delete') {
        console.log('🔧 [WEBHOOK-MGMT] Deleting webhooks for:', site.siteUrl);
        const deleteResults = [];
        
        if (site.recordingWebhookId) {
          try {
            const deleteRecordings = await fetch(`https://webexapis.com/v1/webhooks/${site.recordingWebhookId}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            deleteResults.push(deleteRecordings.ok);
          } catch (error) {
            console.error('Error deleting recordings webhook:', error.message);
            deleteResults.push(false);
          }
        }

        if (site.transcriptWebhookId) {
          try {
            const deleteTranscripts = await fetch(`https://webexapis.com/v1/webhooks/${site.transcriptWebhookId}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            deleteResults.push(deleteTranscripts.ok);
          } catch (error) {
            console.error('Error deleting transcripts webhook:', error.message);
            deleteResults.push(false);
          }
        }

        console.log('🔧 [WEBHOOK-MGMT] Delete results:', deleteResults);
        if (deleteResults.every(r => r)) {
          delete site.recordingWebhookId;
          delete site.transcriptWebhookId;
          console.log('🔧 [WEBHOOK-MGMT] Successfully deleted all webhooks for:', site.siteUrl);
          results.push({ site: site.siteName || site.siteUrl, status: 'deleted' });
        } else {
          console.error('🔧 [WEBHOOK-MGMT] Failed to delete some webhooks for:', site.siteUrl);
          results.push({ site: site.siteName || site.siteUrl, status: 'error' });
        }

      } else if (action === 'validate') {
        console.log('🔧 [WEBHOOK-MGMT] Validating webhooks for:', site.siteUrl);
        
        // Get all webhooks from WebEx to verify configuration
        let allWebhooksResponse;
        try {
          allWebhooksResponse = await fetch('https://webexapis.com/v1/webhooks', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
        } catch (error) {
          results.push({
            site: site.siteName || site.siteUrl,
            status: 'error',
            error: 'Network error fetching webhooks',
            hasWebhooks: false,
            webhookCount: 0
          });
          continue;
        }
        
        if (!allWebhooksResponse.ok) {
          results.push({
            site: site.siteName || site.siteUrl,
            status: 'error',
            error: `Failed to fetch webhooks: ${allWebhooksResponse.status}`,
            hasWebhooks: false,
            webhookCount: 0
          });
          continue;
        }
        
        const allWebhooksData = await allWebhooksResponse.json();
        const allWebhooks = allWebhooksData.items || [];
        
        // Find our webhooks by URL and siteUrl (more reliable than stored IDs)
        const recordingsWebhook = allWebhooks.find(w => 
          w.targetUrl === `${baseUrl}/api/webhooks/webexmeetings/recordings` &&
          w.resource === 'recordings' &&
          (w.siteUrl === site.siteUrl || w.name.includes(site.siteName || site.siteUrl))
        );
        
        const transcriptsWebhook = allWebhooks.find(w => 
          w.targetUrl === `${baseUrl}/api/webhooks/webexmeetings/transcripts` &&
          w.resource === 'meetingTranscripts' &&
          (w.siteUrl === site.siteUrl || w.name.includes(site.siteName || site.siteUrl))
        );
        
        // Test connectivity to our endpoints
        const connectivityTests = [];
        try {
          const testResponse = await fetch(`${baseUrl}/api/webhooks/webexmeetings/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ test: 'validation-connectivity', site: site.siteUrl })
          });
          connectivityTests.push({ endpoint: 'test', reachable: testResponse.ok });
        } catch (error) {
          connectivityTests.push({ endpoint: 'test', reachable: false, error: error.message });
        }
        
        const hasRecordingsWebhook = !!recordingsWebhook;
        const hasTranscriptsWebhook = !!transcriptsWebhook;
        const hasWebhooks = hasRecordingsWebhook || hasTranscriptsWebhook;
        const hasBothWebhooks = hasRecordingsWebhook && hasTranscriptsWebhook;
        
        // Update stored webhook IDs if they've changed
        if (recordingsWebhook && site.recordingWebhookId !== recordingsWebhook.id) {
          site.recordingWebhookId = recordingsWebhook.id;
        }
        if (transcriptsWebhook && site.transcriptWebhookId !== transcriptsWebhook.id) {
          site.transcriptWebhookId = transcriptsWebhook.id;
        }
        
        console.log('🔧 [WEBHOOK-MGMT] Detailed validation for', site.siteUrl, ':', {
          totalWebhooksInWebEx: allWebhooks.length,
          hasRecordingsWebhook,
          hasTranscriptsWebhook,
          recordingsWebhookStatus: recordingsWebhook?.status,
          transcriptsWebhookStatus: transcriptsWebhook?.status,
          connectivityTests
        });
        
        results.push({ 
          site: site.siteName || site.siteUrl, 
          status: hasBothWebhooks ? 'valid' : (hasWebhooks ? 'partial' : 'invalid'),
          hasWebhooks,
          hasBothWebhooks,
          recordingsWebhook: hasRecordingsWebhook ? 'active' : 'missing',
          transcriptsWebhook: hasTranscriptsWebhook ? 'active' : 'missing',
          webhookCount: (hasRecordingsWebhook ? 1 : 0) + (hasTranscriptsWebhook ? 1 : 0),
          webhookDetails: {
            recordings: recordingsWebhook ? {
              id: recordingsWebhook.id,
              status: recordingsWebhook.status,
              targetUrl: recordingsWebhook.targetUrl,
              created: recordingsWebhook.created,
              siteUrl: recordingsWebhook.siteUrl,
              ownedBy: recordingsWebhook.ownedBy
            } : null,
            transcripts: transcriptsWebhook ? {
              id: transcriptsWebhook.id,
              status: transcriptsWebhook.status,
              targetUrl: transcriptsWebhook.targetUrl,
              created: transcriptsWebhook.created,
              siteUrl: transcriptsWebhook.siteUrl,
              ownedBy: transcriptsWebhook.ownedBy
            } : null
          },
          connectivity: connectivityTests,
          totalWebhooksInWebEx: allWebhooks.length,
          allWebhooksForSite: allWebhooks.filter(w => 
            w.name.includes(site.siteName || site.siteUrl) ||
            w.targetUrl.includes(baseUrl) ||
            w.siteUrl === site.siteUrl
          ).map(w => ({
            id: w.id,
            name: w.name,
            resource: w.resource,
            event: w.event,
            targetUrl: w.targetUrl,
            status: w.status,
            filter: w.filter,
            siteUrl: w.siteUrl,
            ownedBy: w.ownedBy
          }))
        });
      }
    }

    await saveWebexMeetingsConfig(config);
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