import { NextResponse } from 'next/server';
import { validateUserSession } from '../../../../lib/auth-check';
import { getTableName } from '../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export async function GET(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tableName = getTableName('Settings');
    const result = await docClient.send(new GetCommand({
      TableName: tableName,
      Key: { setting_key: 'webex-meetings' }
    }));

    if (!result.Item?.setting_value) {
      return NextResponse.json({ isHost: false });
    }

    const config = JSON.parse(result.Item.setting_value);
    const userEmail = validation.user.email.toLowerCase();
    
    const isHost = validation.user.isAdmin || config.sites?.some(site => 
      site.recordingHosts?.some(host => host.email.toLowerCase() === userEmail)
    ) || false;

    return NextResponse.json({ isHost });
  } catch (error) {
    console.error('Error checking host status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
