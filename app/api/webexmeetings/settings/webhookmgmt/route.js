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
        if (site.monitoredRooms && site.monitoredRooms.length > 0) {
          // Step 1: Get service app user ID
          const meResponse = await fetch('https://webexapis.com/v1/people/me', {
            headers: { 
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (!meResponse.ok) {
            console.error('🔧 [WEBHOOK-MGMT] Failed to get service app user ID');
          } else {
            const meData = await meResponse.json();
            const serviceAppPersonId = meData.id;
            
            // Get bot token
            const botTokenParam = env === 'prod'
              ? `/PracticeTools/${siteName}_WEBEX_MESSAGING_BOT_TOKEN_1`
              : `/PracticeTools/dev/${siteName}_WEBEX_MESSAGING_BOT_TOKEN_1`;
            const botToken = await getSecureParameter(botTokenParam);
            
            if (!botToken) {
              console.error('🔧 [WEBHOOK-MGMT] No bot token found');
            } else {
              // Verify existing webhooks
              const existingWebhooksResponse = await fetch('https://webexapis.com/v1/webhooks', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
              });
              const existingWebhooksData = await existingWebhooksResponse.json();
              const existingWebhooks = existingWebhooksData.items || [];
              
              const validWebhookIds = [];
              for (const existingWebhook of messagingWebhookIds) {
                if (existingWebhooks.find(w => w.id === existingWebhook.webhookId)) {
                  validWebhookIds.push(existingWebhook);
                }
              }
              
              for (const room of site.monitoredRooms) {
                console.error('🔧 [WEBHOOK-MGMT] Processing room:', room.title, room.id);
                
                if (validWebhookIds.find(w => w.roomId === room.id)) {
                  console.error('🔧 [WEBHOOK-MGMT] Webhook already exists for room, skipping');
                  continue;
                }
                
                // Step 2: Add service app user to room using bot token
                const membershipPayload = {
                  roomId: room.id,
                  personId: serviceAppPersonId
                };
                
                console.error('🔧 [WEBHOOK-MGMT] Adding service app to room...');
                const membershipResponse = await fetch('https://webexapis.com/v1/memberships', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${botToken}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(membershipPayload)
                });
                
                console.error('🔧 [WEBHOOK-MGMT] Membership response status:', membershipResponse.status);
                if (!membershipResponse.ok && membershipResponse.status !== 409) {
                  const errorText = await membershipResponse.text();
                  console.error('🔧 [WEBHOOK-MGMT] Failed to add service app to room:', room.title, errorText);
                  continue;
                } else if (membershipResponse.status === 409) {
                  console.error('🔧 [WEBHOOK-MGMT] Service app already member of room');
                } else {
                  const membershipData = await membershipResponse.json();
                  console.error('🔧 [WEBHOOK-MGMT] Service app added to room, membership ID:', membershipData.id);
                }
                
                // Step 3: Create webhook using service app access token
                const webhookPayload = {
                  name: `PracticeTools Messages - ${room.title}`,
                  targetUrl: `${baseUrl}/api/webhooks/webexmessaging/messages`,
                  resource: 'messages',
                  event: 'created',
                  filter: `roomId=${room.id}`
                };
                
                console.error('🔧 [WEBHOOK-MGMT] Creating webhook for room...');
                const webhookResponse = await fetch('https://webexapis.com/v1/webhooks', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(webhookPayload)
                });
                
                console.error('🔧 [WEBHOOK-MGMT] Webhook response status:', webhookResponse.status);
                if (webhookResponse.ok) {
                  const webhookResult = await webhookResponse.json();
                  validWebhookIds.push({ roomId: room.id, webhookId: webhookResult.id });
                  console.error('🔧 [WEBHOOK-MGMT] ✅ Webhook created:', webhookResult.id);
                } else {
                  const errorText = await webhookResponse.text();
                  console.error('🔧 [WEBHOOK-MGMT] ❌ Webhook creation failed:', errorText);
                }
              }
              
              site.messagingWebhookIds = validWebhookIds;
              console.error('🔧 [WEBHOOK-MGMT] Final validWebhookIds:', JSON.stringify(validWebhookIds));
            }
          }
        }
        
        // Skip recordings webhook if it already exists in Webex
        if (existingRecordingsWebhook) {
          site.recordingWebhookId = existingRecordingsWebhook.id;
          results.push({ 
            site: site.siteName || site.siteUrl, 
            status: 'created',
            recordingWebhookId: existingRecordingsWebhook.id,
            messagingWebhookCount: site.messagingWebhookIds?.length || 0
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

        if (deleteSuccess || messagingDeleteCount > 0) {
          delete site.recordingWebhookId;
          delete site.messagingWebhookIds;
          results.push({ site: site.siteName || site.siteUrl, status: 'deleted', messagingDeleteCount });
        } else {
          results.push({ site: site.siteName || site.siteUrl, status: 'error' });
        }

      } else if (action === 'validate') {
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
        
        const recordingsWebhook = allWebhooks.find(w => 
          w.targetUrl === `${baseUrl}/api/webhooks/webexmeetings/recordings` &&
          w.resource === 'recordings'
        );
        
        const messagingWebhooks = allWebhooks.filter(w =>
          w.targetUrl === `${baseUrl}/api/webhooks/webexmessaging/messages` &&
          w.resource === 'messages' &&
          w.event === 'created'
        );
        
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
          totalWebhooksInWebEx: allWebhooks.length
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