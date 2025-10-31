import { NextResponse } from 'next/server';
import { getTableName } from '../../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { getSecureParameter, setSecureParameter } from '../../../../../lib/ssm-config';
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
      
      let accessToken = await getSecureParameter(accessTokenParam);
      const refreshToken = await getSecureParameter(refreshTokenParam);
      
      // Get client credentials for token refresh
      const clientIdParam = env === 'prod' 
        ? `/PracticeTools/${siteName}_WEBEX_MEETINGS_CLIENT_ID`
        : `/PracticeTools/dev/${siteName}_WEBEX_MEETINGS_CLIENT_ID`;
      const clientSecretParam = env === 'prod'
        ? `/PracticeTools/${siteName}_WEBEX_MEETINGS_CLIENT_SECRET`
        : `/PracticeTools/dev/${siteName}_WEBEX_MEETINGS_CLIENT_SECRET`;
      
      const clientId = await getSecureParameter(clientIdParam);
      const clientSecret = await getSecureParameter(clientSecretParam);
      
      // Test if access token is valid, refresh if needed
      if (accessToken && refreshToken && clientId && clientSecret) {
        console.log('🔧 [WEBHOOK-MGMT] Testing access token validity for:', site.siteUrl);
        const testResponse = await fetch('https://webexapis.com/v1/people/me', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (!testResponse.ok) {
          console.log('🔧 [WEBHOOK-MGMT] Access token invalid, refreshing for:', site.siteUrl);
          try {
            const refreshResponse = await fetch('https://webexapis.com/v1/access_token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken
              })
            });
            
            if (refreshResponse.ok) {
              const tokenData = await refreshResponse.json();
              accessToken = tokenData.access_token;
              
              // Save new tokens to SSM
              await setSecureParameter(accessTokenParam, accessToken);
              if (tokenData.refresh_token) {
                await setSecureParameter(refreshTokenParam, tokenData.refresh_token);
              }
              
              console.log('🔧 [WEBHOOK-MGMT] Successfully refreshed access token for:', site.siteUrl);
            } else {
              const errorData = await refreshResponse.json();
              console.error('🔧 [WEBHOOK-MGMT] Token refresh failed for:', site.siteUrl, errorData);
              results.push({ site: site.siteName || site.siteUrl, status: 'error', error: 'Token refresh failed' });
              continue;
            }
          } catch (refreshError) {
            console.error('🔧 [WEBHOOK-MGMT] Token refresh error for:', site.siteUrl, refreshError);
            results.push({ site: site.siteName || site.siteUrl, status: 'error', error: 'Token refresh error' });
            continue;
          }
        } else {
          console.log('🔧 [WEBHOOK-MGMT] Access token is valid for:', site.siteUrl);
        }
      }
      
      console.log('🔧 [WEBHOOK-MGMT] Site details:', {
        siteUrl: site.siteUrl,
        siteName: site.siteName,
        hasAccessToken: !!accessToken,
        accessTokenLength: accessToken?.length,
        hasRefreshToken: !!refreshToken,
        recordingHosts: site.recordingHosts,
        existingRecordingWebhookId: site.recordingWebhookId
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
      
      // Load monitored rooms from SSM if not already in site object
      if (!site.monitoredRooms) {
        const monitoredRooms = [];
        let roomIndex = 1;
        while (true) {
          const roomNameParam = env === 'prod'
            ? `/PracticeTools/${siteName}_WEBEX_MESSAGING_ROOM_NAME_${roomIndex}`
            : `/PracticeTools/dev/${siteName}_WEBEX_MESSAGING_ROOM_NAME_${roomIndex}`;
          const roomIdParam = env === 'prod'
            ? `/PracticeTools/${siteName}_WEBEX_MESSAGING_ROOM_ID_${roomIndex}`
            : `/PracticeTools/dev/${siteName}_WEBEX_MESSAGING_ROOM_ID_${roomIndex}`;
          
          const roomName = await getSecureParameter(roomNameParam);
          const roomId = await getSecureParameter(roomIdParam);
          
          if (!roomName || !roomId) break;
          
          monitoredRooms.push({ title: roomName, id: roomId });
          roomIndex++;
        }
        if (monitoredRooms.length > 0) {
          site.monitoredRooms = monitoredRooms;
          console.log('🔧 [WEBHOOK-MGMT] Loaded monitored rooms from SSM:', monitoredRooms.length);
        }
      }
      
      if (action === 'create') {
        console.error('🔧 [WEBHOOK-MGMT] ===== CREATE ACTION STARTED =====');
        console.error('🔧 [WEBHOOK-MGMT] Creating webhooks for:', site.siteUrl);
        console.error('🔧 [WEBHOOK-MGMT] Monitored rooms:', JSON.stringify(site.monitoredRooms));
        
        // Check existing webhooks in Webex first
        const allWebhooksResponse = await fetch('https://webexapis.com/v1/webhooks', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const allWebhooksData = await allWebhooksResponse.json();
        const allWebhooks = allWebhooksData.items || [];
        
        const existingRecordingsWebhook = allWebhooks.find(w => 
          w.targetUrl === `${baseUrl}/api/webhooks/webexmeetings/recordings` &&
          w.resource === 'recordings'
        );
        
        // Create webhooks for Webex Messaging if monitored rooms exist
        const messagingWebhookIds = site.messagingWebhookIds || [];
        console.error('🔧 [WEBHOOK-MGMT] Checking monitored rooms:', {
          hasMonitoredRooms: !!site.monitoredRooms,
          roomCount: site.monitoredRooms?.length || 0,
          rooms: site.monitoredRooms
        });
        if (site.monitoredRooms && site.monitoredRooms.length > 0) {
          console.error('🔧 [WEBHOOK-MGMT] Creating messaging webhooks for', site.monitoredRooms.length, 'rooms');
          
          // Generate or retrieve shared secret for webhook validation
          if (!site.webhookSecret) {
            site.webhookSecret = require('crypto').randomBytes(32).toString('hex');
            console.log('🔧 [WEBHOOK-MGMT] Generated new webhook secret');
          }
          
          for (const room of site.monitoredRooms) {
            if (messagingWebhookIds.find(w => w.roomId === room.id)) {
              console.log('🔧 [WEBHOOK-MGMT] Messaging webhook already exists for room:', room.title);
              continue;
            }
            
            const messagingPayload = {
              name: `PracticeTools Messages - ${room.title}`,
              targetUrl: `${baseUrl}/api/webhooks/webexmessaging/messages`,
              resource: 'messages',
              event: 'created',
              filter: `roomId=${room.id}`,
              secret: site.webhookSecret
            };
            
            try {
              console.log('🔧 [WEBHOOK-MGMT] Messaging webhook payload:', JSON.stringify(messagingPayload, null, 2));
              const messagingWebhook = await fetch('https://webexapis.com/v1/webhooks', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(messagingPayload)
              });
              
              console.log('🔧 [WEBHOOK-MGMT] Messaging webhook response status:', messagingWebhook.status);
              
              if (messagingWebhook.ok) {
                const messagingResult = await messagingWebhook.json();
                messagingWebhookIds.push({ roomId: room.id, webhookId: messagingResult.id });
                console.log('🔧 [WEBHOOK-MGMT] ✅ Created messaging webhook for room:', room.title, 'ID:', messagingResult.id);
              } else {
                const errorText = await messagingWebhook.text();
                console.error('🔧 [WEBHOOK-MGMT] ❌ Failed to create messaging webhook for room:', room.title);
                console.error('🔧 [WEBHOOK-MGMT] Status:', messagingWebhook.status);
                console.error('🔧 [WEBHOOK-MGMT] Error response:', errorText);
                try {
                  const errorJson = JSON.parse(errorText);
                  console.error('🔧 [WEBHOOK-MGMT] Error details:', JSON.stringify(errorJson, null, 2));
                } catch (e) {}
              }
            } catch (error) {
              console.error('🔧 [WEBHOOK-MGMT] ❌ Exception creating messaging webhook:', error.message);
              console.error('🔧 [WEBHOOK-MGMT] Stack:', error.stack);
            }
          }
        }
        
        // Skip recordings webhook if it already exists in Webex
        if (existingRecordingsWebhook) {
          console.log('🔧 [WEBHOOK-MGMT] Recordings webhook already exists in Webex, skipping creation');
          site.recordingWebhookId = existingRecordingsWebhook.id;
          if (messagingWebhookIds.length > 0) {
            site.messagingWebhookIds = messagingWebhookIds;
          }
          results.push({ 
            site: site.siteName || site.siteUrl, 
            status: 'created',
            recordingWebhookId: existingRecordingsWebhook.id,
            messagingWebhookCount: messagingWebhookIds.length,
            skipped: 'recordings webhook already exists in Webex'
          });
          continue;
        }
        
        // Create webhook for Webex Meetings recordings
        const recordingsPayload = {
          name: `PracticeTools Recordings - ${site.siteName || site.siteUrl}`,
          targetUrl: `${baseUrl}/api/webhooks/webexmeetings/recordings`,
          resource: 'recordings',
          event: 'created',
          ownedBy: 'org'
        };
        console.log('🔧 [WEBHOOK-MGMT] Recordings webhook payload:', recordingsPayload);
        
        let recordingsWebhook;
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

        console.log('🔧 [WEBHOOK-MGMT] Recordings webhook status:', recordingsWebhook.status);
        console.log('🔧 [WEBHOOK-MGMT] Recordings webhook headers:', Object.fromEntries(recordingsWebhook.headers.entries()));
        
        let recordingsResult;
        try {
          recordingsResult = await recordingsWebhook.json();
        } catch (parseError) {
          console.error('🔧 [WEBHOOK-MGMT] Error parsing webhook response:', parseError);
          results.push({ site: site.siteName || site.siteUrl, status: 'error', error: `Failed to parse webhook response: ${parseError.message}` });
          continue;
        }
        
        console.log('🔧 [WEBHOOK-MGMT] Recordings result:', JSON.stringify(recordingsResult, null, 2));

        if (recordingsWebhook.ok) {
          console.log('🔧 [WEBHOOK-MGMT] Webhook created successfully for:', site.siteUrl);
          site.recordingWebhookId = recordingsResult.id;
          if (messagingWebhookIds.length > 0) {
            site.messagingWebhookIds = messagingWebhookIds;
          }
          console.log('🔧 [WEBHOOK-MGMT] Assigned webhook IDs:', {
            recordingWebhookId: recordingsResult.id,
            messagingWebhookIds
          });
          results.push({ 
            site: site.siteName || site.siteUrl, 
            status: 'created',
            recordingWebhookId: recordingsResult.id,
            messagingWebhookCount: messagingWebhookIds.length
          });
        } else {
          const recordingsError = recordingsResult.message || recordingsResult.errors?.[0]?.description || `HTTP ${recordingsWebhook.status}`;
          
          console.error('🔧 [WEBHOOK-MGMT] Webhook creation failed for', site.siteUrl, ':', {
            recordingsOk: recordingsWebhook.ok,
            recordingsError,
            recordingsResult
          });
          results.push({ 
            site: site.siteName || site.siteUrl, 
            status: 'error', 
            error: recordingsError
          });
        }

      } else if (action === 'delete') {
        console.log('🔧 [WEBHOOK-MGMT] Deleting webhooks for:', site.siteUrl);
        let deleteSuccess = false;
        let messagingDeleteCount = 0;
        
        if (site.recordingWebhookId) {
          try {
            const deleteRecordings = await fetch(`https://webexapis.com/v1/webhooks/${site.recordingWebhookId}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            deleteSuccess = deleteRecordings.ok;
          } catch (error) {
            console.error('Error deleting recordings webhook:', error.message);
            deleteSuccess = false;
          }
        }
        
        if (site.messagingWebhookIds && site.messagingWebhookIds.length > 0) {
          for (const webhook of site.messagingWebhookIds) {
            try {
              const deleteMessaging = await fetch(`https://webexapis.com/v1/webhooks/${webhook.webhookId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${accessToken}` }
              });
              if (deleteMessaging.ok) messagingDeleteCount++;
            } catch (error) {
              console.error('Error deleting messaging webhook:', error.message);
            }
          }
        }

        console.log('🔧 [WEBHOOK-MGMT] Delete result:', { deleteSuccess, messagingDeleteCount });
        if (deleteSuccess || messagingDeleteCount > 0) {
          delete site.recordingWebhookId;
          delete site.messagingWebhookIds;
          console.log('🔧 [WEBHOOK-MGMT] Successfully deleted webhooks for:', site.siteUrl);
          results.push({ site: site.siteName || site.siteUrl, status: 'deleted', messagingDeleteCount });
        } else {
          console.error('🔧 [WEBHOOK-MGMT] Failed to delete webhooks for:', site.siteUrl);
          results.push({ site: site.siteName || site.siteUrl, status: 'error' });
        }

      } else if (action === 'validate') {
        console.log('🔧 [WEBHOOK-MGMT] Validating webhooks for:', site.siteUrl);
        
        // Get all webhooks from Meetings token
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
        
        // Find recordings webhook
        const recordingsWebhook = allWebhooks.find(w => 
          w.targetUrl === `${baseUrl}/api/webhooks/webexmeetings/recordings` &&
          w.resource === 'recordings' &&
          (w.siteUrl === site.siteUrl || w.name.includes(site.siteName || site.siteUrl))
        );
        
        // Get messaging webhooks using same access token
        const messagingWebhooks = allWebhooks.filter(w =>
          w.targetUrl === `${baseUrl}/api/webhooks/webexmessaging/messages` &&
          w.resource === 'messages' &&
          w.event === 'created'
        );
        
        // Test connectivity to our endpoint
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
        const hasMessagingWebhooks = messagingWebhooks.length > 0;
        
        if (recordingsWebhook && site.recordingWebhookId !== recordingsWebhook.id) {
          site.recordingWebhookId = recordingsWebhook.id;
        }
        if (hasMessagingWebhooks) {
          site.messagingWebhookIds = messagingWebhooks.map(w => ({
            webhookId: w.id,
            roomId: w.filter?.replace('roomId=', '')
          }));
        }
        
        console.log('🔧 [WEBHOOK-MGMT] Detailed validation for', site.siteUrl, ':', {
          totalWebhooksInWebEx: allWebhooks.length,
          hasRecordingsWebhook,
          hasMessagingWebhooks,
          messagingWebhookCount: messagingWebhooks.length,
          recordingsWebhookStatus: recordingsWebhook?.status,
          connectivityTests
        });
        
        results.push({ 
          site: site.siteName || site.siteUrl, 
          status: (hasRecordingsWebhook || hasMessagingWebhooks) ? 'valid' : 'invalid',
          hasWebhooks: hasRecordingsWebhook || hasMessagingWebhooks,
          hasBothWebhooks: hasRecordingsWebhook,
          recordingsWebhook: hasRecordingsWebhook ? 'active' : 'missing',
          messagingWebhooks: hasMessagingWebhooks ? 'active' : 'missing',
          webhookCount: (hasRecordingsWebhook ? 1 : 0) + messagingWebhooks.length,
          webhookDetails: {
            recordings: recordingsWebhook ? {
              id: recordingsWebhook.id,
              status: recordingsWebhook.status,
              targetUrl: recordingsWebhook.targetUrl,
              created: recordingsWebhook.created,
              siteUrl: recordingsWebhook.siteUrl,
              ownedBy: recordingsWebhook.ownedBy
            } : null,
            messaging: messagingWebhooks.map(w => ({
              id: w.id,
              status: w.status,
              targetUrl: w.targetUrl,
              filter: w.filter,
              created: w.created
            }))
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