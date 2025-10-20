import { NextResponse } from 'next/server';
import { getEnvironment, getTableName } from '../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { notifyWebexMeetingsUpdate } from '../../sse/webex-meetings/route.js';
import { storeWebexTokens, getWebexTokens } from '../../../../lib/ssm.js';
import { getValidAccessToken } from '../../../../lib/webex-token-manager.js';

const client = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

export async function GET() {
  try {
    const tableName = getTableName('Settings');
    const environment = getEnvironment();
    
    const command = new GetCommand({
      TableName: tableName,
      Key: { setting_key: `${environment}_webex_meetings` }
    });
    
    const result = await docClient.send(command);
    
    if (result.Item?.setting_value) {
      const parsedData = JSON.parse(result.Item.setting_value);
      
      // Load valid tokens for each site (auto-refresh if needed)
      const sitesWithTokens = await Promise.all(
        (parsedData.sites || []).map(async (site) => {
          try {
            const validAccessToken = await getValidAccessToken(site.siteUrl);
            const tokens = await getWebexTokens(site.siteUrl);
            return {
              ...site,
              accessToken: validAccessToken,
              refreshToken: tokens?.refreshToken || ''
            };
          } catch (error) {
            console.error(`Failed to get valid token for ${site.siteUrl}:`, error);
            return {
              ...site,
              accessToken: '',
              refreshToken: ''
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
    
    // Validate input
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid enabled value' }, { status: 400 });
    }
    
    if (!Array.isArray(sites)) {
      return NextResponse.json({ error: 'Sites must be an array' }, { status: 400 });
    }
    
    // Validate each site
    for (const site of sites) {
      if (!site.siteUrl || !site.accessToken || !site.refreshToken || !Array.isArray(site.recordingHosts)) {
        return NextResponse.json({ error: 'Invalid site configuration' }, { status: 400 });
      }
      
      if (site.recordingHosts.length === 0) {
        return NextResponse.json({ error: 'At least one recording host is required per site' }, { status: 400 });
      }
    }
    
    // Store tokens in SSM for each site
    await Promise.all(
      sites.map(site => storeWebexTokens(site.siteUrl, site.accessToken, site.refreshToken))
    );
    
    // Store configuration in DynamoDB (without tokens)
    const sitesWithoutTokens = sites.map(site => ({
      siteUrl: site.siteUrl,
      recordingHosts: site.recordingHosts
    }));
    
    const command = new PutCommand({
      TableName: tableName,
      Item: {
        setting_key: `${environment}_webex_meetings`,
        setting_value: JSON.stringify({
          enabled,
          sites: sitesWithoutTokens
        }),
        environment,
        updated_at: new Date().toISOString()
      }
    });
    
    await docClient.send(command);
    
    // DSR: Send SSE notification for real-time updates
    try {
      notifyWebexMeetingsUpdate({
        enabled,
        sites: sitesWithoutTokens
      });
    } catch (sseError) {
      console.error('Failed to send SSE notification:', sseError);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving Webex Meetings settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}