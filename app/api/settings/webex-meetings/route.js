import { NextResponse } from 'next/server';
import { getEnvironment, getTableName } from '../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

export async function GET() {
  try {
    const tableName = getTableName('Settings');
    const environment = getEnvironment();
    
    const command = new GetCommand({
      TableName: tableName,
      Key: { id: `${environment}_webex_meetings` }
    });
    
    const result = await docClient.send(command);
    
    return NextResponse.json({
      enabled: result.Item?.enabled || false,
      sites: result.Item?.sites || []
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
    
    const command = new PutCommand({
      TableName: tableName,
      Item: {
        id: `${environment}_webex_meetings`,
        setting_key: 'webex_meetings',
        environment,
        enabled,
        sites,
        updated_at: new Date().toISOString()
      }
    });
    
    await docClient.send(command);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving Webex Meetings settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}