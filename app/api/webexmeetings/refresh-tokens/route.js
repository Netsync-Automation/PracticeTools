import { NextResponse } from 'next/server';
import { refreshAllTokens } from '../../../../lib/webex-token-manager.js';
import { getEnvironment, getTableName } from '../../../../lib/dynamodb.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

export async function POST(request) {
  try {
    const { adminKey } = await request.json();
    
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const tableName = getTableName('Settings');
    const environment = getEnvironment();
    
    const command = new GetCommand({
      TableName: tableName,
      Key: { setting_key: `${environment}_webex_meetings` }
    });
    
    const result = await docClient.send(command);
    
    if (!result.Item?.setting_value) {
      return NextResponse.json({ error: 'No sites configured' }, { status: 404 });
    }
    
    const parsedData = JSON.parse(result.Item.setting_value);
    
    if (!parsedData.enabled || !parsedData.sites?.length) {
      return NextResponse.json({ error: 'Webex Meetings not enabled or no sites configured' }, { status: 400 });
    }
    
    await refreshAllTokens(parsedData.sites);
    
    return NextResponse.json({ success: true, refreshedSites: parsedData.sites.length });
  } catch (error) {
    console.error('Token refresh failed:', error);
    return NextResponse.json({ error: 'Token refresh failed' }, { status: 500 });
  }
}