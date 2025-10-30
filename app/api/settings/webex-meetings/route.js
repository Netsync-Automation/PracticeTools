import { NextResponse } from 'next/server';
import { getEnvironment, getTableName } from '../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { notifyWebexMeetingsUpdate } from '../../sse/webex-meetings/route.js';
import { storeWebexTokens, getWebexTokens, storeWebexCredentials, getWebexCredentials } from '../../../../lib/ssm.js';
import { getValidAccessToken } from '../../../../lib/webex-token-manager.js';

const client = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

export async function GET() {
  try {
    const tableName = getTableName('Settings');
    const environment = getEnvironment();
    
    const command = new GetCommand({
      TableName: tableName,
      Key: { setting_key: 'webex-meetings' }
    });
    
    const result = await docClient.send(command);
    
    if (result.Item?.setting_value) {
      const parsedData = JSON.parse(result.Item.setting_value);
      
      // Load valid tokens, credentials, and monitored rooms for each site
      const sitesWithTokens = await Promise.all(
        (parsedData.sites || []).map(async (site) => {
          try {
            const validAccessToken = await getValidAccessToken(site.siteUrl);
            const tokens = await getWebexTokens(site.siteUrl);
            const credentials = await getWebexCredentials(site.siteUrl);
            
            // Load monitored rooms from SSM via API
            let monitoredRooms = [];
            try {
              const roomsResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/webexmessaging/monitored-rooms?siteUrl=${encodeURIComponent(site.siteUrl)}`);
              if (roomsResponse.ok) {
                const roomsData = await roomsResponse.json();
                monitoredRooms = roomsData.rooms || [];
              }
            } catch (error) {
              console.error(`Failed to load monitored rooms for ${site.siteUrl}:`, error);
            }
            
            return {
              ...site,
              accessToken: validAccessToken,
              refreshToken: tokens?.refreshToken || '',
              clientId: credentials?.clientId || '',
              clientSecret: credentials?.clientSecret || '',
              monitoredRooms
            };
          } catch (error) {
            console.error(`Failed to get valid token for ${site.siteUrl}:`, error);
            return {
              ...site,
              accessToken: '',
              refreshToken: '',
              clientId: '',
              clientSecret: '',
              monitoredRooms: []
            };
          }
        })
      );
      
      return NextResponse.json({
        enabled: parsedData.enabled || false,
        sites: sitesWithTokens
      });
    }
    
    return NextResponse.json({
      enabled: false,
      sites: []
    });
  } catch (error) {
    console.error('Error loading Webex Meetings settings:', error);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { enabled, sites } = await request.json();
    const tableName = getTableName('Settings');
    const environment = getEnvironment();
    
    console.log('🔧 [DEBUG] Webex Meetings save operation started');
    console.log('🔧 [DEBUG] Environment:', environment);
    console.log('🔧 [DEBUG] Table name:', tableName);
    console.log('🔧 [DEBUG] Enabled:', enabled);
    console.log('🔧 [DEBUG] Sites count:', sites?.length || 0);
    console.log('🔧 [DEBUG] Raw sites data:', JSON.stringify(sites, null, 2));
    
    // Validate input
    if (typeof enabled !== 'boolean') {
      console.log('❌ [DEBUG] Invalid enabled value:', enabled);
      return NextResponse.json({ error: 'Invalid enabled value' }, { status: 400 });
    }
    
    if (!Array.isArray(sites)) {
      console.log('❌ [DEBUG] Sites is not an array:', typeof sites);
      return NextResponse.json({ error: 'Sites must be an array' }, { status: 400 });
    }
    
    // Validate each site
    console.log('🔧 [DEBUG] Starting site validation...');
    for (let i = 0; i < sites.length; i++) {
      const site = sites[i];
      console.log(`🔧 [DEBUG] Validating site ${i + 1}:`, site.siteUrl);
      console.log(`🔧 [DEBUG] Site ${i + 1} recording hosts:`, JSON.stringify(site.recordingHosts, null, 2));
      
      if (!site.siteUrl || !site.accessToken || !site.refreshToken || !Array.isArray(site.recordingHosts)) {
        console.log(`❌ [DEBUG] Site ${i + 1} missing required fields:`, {
          siteUrl: !!site.siteUrl,
          accessToken: !!site.accessToken,
          refreshToken: !!site.refreshToken,
          recordingHostsIsArray: Array.isArray(site.recordingHosts)
        });
        return NextResponse.json({ error: 'Invalid site configuration - missing required fields' }, { status: 400 });
      }
      
      if (site.recordingHosts.length === 0) {
        console.log(`❌ [DEBUG] Site ${i + 1} has no recording hosts`);
        return NextResponse.json({ error: 'At least one recording host is required per site' }, { status: 400 });
      }
      
      // Validate recording hosts format (can be strings or objects with email property)
      for (let j = 0; j < site.recordingHosts.length; j++) {
        const host = site.recordingHosts[j];
        const email = typeof host === 'string' ? host : host.email;
        console.log(`🔧 [DEBUG] Site ${i + 1} host ${j + 1}:`, { type: typeof host, email, host });
        if (!email || !email.trim()) {
          console.log(`❌ [DEBUG] Site ${i + 1} host ${j + 1} has invalid email:`, host);
          return NextResponse.json({ error: 'All recording hosts must have valid email addresses' }, { status: 400 });
        }
      }
      
      if (!site.clientId || !site.clientSecret) {
        console.log(`❌ [DEBUG] Site ${i + 1} missing client credentials:`, {
          clientId: !!site.clientId,
          clientSecret: !!site.clientSecret
        });
        return NextResponse.json({ error: 'Client ID and Client Secret are required for service apps' }, { status: 400 });
      }
    }
    console.log('✅ [DEBUG] Site validation completed successfully');
    
    // Store tokens and credentials in SSM for each site
    console.log('🔧 [DEBUG] Starting SSM storage...');
    await Promise.all(
      sites.map(async (site, index) => {
        console.log(`🔧 [DEBUG] Storing SSM data for site ${index + 1}: ${site.siteUrl}`);
        await storeWebexTokens(site.siteUrl, site.accessToken, site.refreshToken);
        await storeWebexCredentials(site.siteUrl, site.clientId, site.clientSecret);
        console.log(`✅ [DEBUG] SSM storage completed for site ${index + 1}: ${site.siteUrl}`);
      })
    );
    console.log('✅ [DEBUG] All SSM storage completed');
    
    // Resolve recording host emails to user IDs using People API
    console.log('🔧 [DEBUG] Starting People API resolution...');
    const sitesWithResolvedHosts = await Promise.all(
      sites.map(async (site, siteIndex) => {
        console.log(`🔧 [DEBUG] Processing site ${siteIndex + 1}: ${site.siteUrl}`);
        console.log(`🔧 [DEBUG] Site ${siteIndex + 1} input recording hosts:`, JSON.stringify(site.recordingHosts, null, 2));
        
        const resolvedHosts = await Promise.all(
          site.recordingHosts.map(async (hostItem, hostIndex) => {
            console.log(`🔧 [DEBUG] Site ${siteIndex + 1} processing host ${hostIndex + 1}:`, hostItem);
            
            // Handle both string emails and objects with email property
            const email = typeof hostItem === 'string' ? hostItem : hostItem.email;
            const hostEntry = { email };
            
            console.log(`🔧 [DEBUG] Site ${siteIndex + 1} host ${hostIndex + 1} email extracted: ${email}`);
            
            // If it's already an object with userId, preserve it
            if (typeof hostItem === 'object' && hostItem.userId) {
              hostEntry.userId = hostItem.userId;
              console.log(`🔧 [DEBUG] Site ${siteIndex + 1} host ${hostIndex + 1} using existing user ID: ${hostEntry.userId}`);
              return hostEntry;
            }
            
            if (email && email.includes('@')) {
              try {
                console.log(`🔧 [DEBUG] Site ${siteIndex + 1} host ${hostIndex + 1} resolving email ${email} to user ID...`);
                const userResponse = await fetch(`https://webexapis.com/v1/people?email=${encodeURIComponent(email)}`, {
                  headers: { 'Authorization': `Bearer ${site.accessToken}` }
                });
                console.log(`🔧 [DEBUG] Site ${siteIndex + 1} host ${hostIndex + 1} People API response status: ${userResponse.status}`);
                
                if (userResponse.ok) {
                  const userData = await userResponse.json();
                  console.log(`🔧 [DEBUG] Site ${siteIndex + 1} host ${hostIndex + 1} People API response:`, JSON.stringify(userData, null, 2));
                  
                  if (userData.items && userData.items.length > 0) {
                    hostEntry.userId = userData.items[0].id;
                    console.log(`✅ [DEBUG] Site ${siteIndex + 1} host ${hostIndex + 1} resolved ${email} to user ID: ${hostEntry.userId}`);
                  } else {
                    console.log(`❌ [DEBUG] Site ${siteIndex + 1} host ${hostIndex + 1} no user found for ${email}`);
                  }
                } else {
                  const errorText = await userResponse.text();
                  console.log(`❌ [DEBUG] Site ${siteIndex + 1} host ${hostIndex + 1} People API error: ${errorText}`);
                }
              } catch (error) {
                console.error(`❌ [DEBUG] Site ${siteIndex + 1} host ${hostIndex + 1} error resolving email ${email}:`, error.message);
              }
            } else {
              console.log(`⚠️ [DEBUG] Site ${siteIndex + 1} host ${hostIndex + 1} invalid email format: ${email}`);
            }
            
            console.log(`🔧 [DEBUG] Site ${siteIndex + 1} host ${hostIndex + 1} final hostEntry:`, hostEntry);
            return hostEntry;
          })
        );
        
        console.log(`🔧 [DEBUG] Site ${siteIndex + 1} resolved hosts:`, JSON.stringify(resolvedHosts, null, 2));
        
        const processedSite = {
          siteUrl: site.siteUrl,
          recordingHosts: resolvedHosts,
          siteName: site.siteName || site.siteUrl.split('.')[0],
          botName: site.botName || '',
          botEmail: site.botEmail || ''
        };
        
        console.log(`✅ [DEBUG] Site ${siteIndex + 1} processing completed:`, JSON.stringify(processedSite, null, 2));
        return processedSite;
      })
    );
    
    console.log('✅ [DEBUG] All People API resolution completed');
    console.log('🔧 [DEBUG] Final sitesWithResolvedHosts:', JSON.stringify(sitesWithResolvedHosts, null, 2));
    
    const finalData = {
      enabled,
      sites: sitesWithResolvedHosts
    };
    
    console.log('🔧 [DEBUG] Preparing to save to database...');
    console.log('🔧 [DEBUG] Final data to be saved:', JSON.stringify(finalData, null, 2));
    
    const command = new PutCommand({
      TableName: tableName,
      Item: {
        setting_key: 'webex-meetings',
        setting_value: JSON.stringify(finalData),
        updated_at: new Date().toISOString()
      }
    });
    
    console.log('🔧 [DEBUG] DynamoDB command:', JSON.stringify(command.input, null, 2));
    
    await docClient.send(command);
    console.log('✅ [DEBUG] Database save completed successfully');
    
    // DSR: Send SSE notification for real-time updates
    try {
      notifyWebexMeetingsUpdate({
        enabled,
        sites: sitesWithResolvedHosts
      });
    } catch (sseError) {
      console.error('Failed to send SSE notification:', sseError);
    }
    
    console.log('✅ [DEBUG] Webex Meetings save operation completed successfully');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ [DEBUG] Error saving Webex Meetings settings:', error);
    console.error('❌ [DEBUG] Error stack:', error.stack);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}