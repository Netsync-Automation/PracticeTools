import { NextResponse } from 'next/server';
import { SSMClient, GetParameterCommand, PutParameterCommand } from '@aws-sdk/client-ssm';
import { DynamoDBClient, GetItemCommand, PutItemCommand, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { getEnvironment, getTableName } from '../../../../lib/dynamodb';

export const dynamic = 'force-dynamic';

const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

async function getSSMParameter(name) {
  try {
    const command = new GetParameterCommand({
      Name: name,
      WithDecryption: true
    });
    const response = await ssmClient.send(command);
    return response.Parameter?.Value;
  } catch (error) {
    return null;
  }
}

async function putSSMParameter(name, value) {
  try {
    const command = new PutParameterCommand({
      Name: name,
      Value: value,
      Type: 'SecureString',
      Overwrite: true
    });
    await ssmClient.send(command);
    return true;
  } catch (error) {
    console.error(`Error setting SSM parameter ${name}:`, error);
    return false;
  }
}

async function ensureTableExists(tableName) {
  try {
    await dynamoClient.send(new DescribeTableCommand({ TableName: tableName }));
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      await dynamoClient.send(new CreateTableCommand({
        TableName: tableName,
        KeySchema: [{ AttributeName: 'setting_key', KeyType: 'HASH' }],
        AttributeDefinitions: [{ AttributeName: 'setting_key', AttributeType: 'S' }],
        BillingMode: 'PAY_PER_REQUEST'
      }));
    }
  }
}

export async function GET() {
  try {
    const env = getEnvironment();
    const prefix = env === 'prod' ? '/PracticeTools' : `/PracticeTools/${env}`;
    
    // Get SSM parameters
    const clientId = await getSSMParameter(`${prefix}/WEBEX_MEETINGS_CLIENT_ID`);
    
    // Get database settings
    const tableName = getTableName('settings');
    await ensureTableExists(tableName);
    
    const getCommand = new GetItemCommand({
      TableName: tableName,
      Key: { setting_key: { S: 'webex_meetings' } }
    });
    
    let dbSettings = {};
    try {
      const response = await dynamoClient.send(getCommand);
      if (response.Item) {
        dbSettings = JSON.parse(response.Item.setting_value.S);
      }
    } catch (error) {
      console.log('No existing webex meetings settings found');
    }
    
    return NextResponse.json({
      webexClientId: clientId || '',
      webexClientSecret: clientId ? 'STORED_IN_SSM' : '',
      webexSiteUrl: dbSettings.webexSiteUrl || '',
      webexEnabled: dbSettings.webexEnabled || false
    });
  } catch (error) {
    console.error('Error loading Webex Meetings settings:', error);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { webexClientId, webexClientSecret, webexSiteUrl, webexEnabled } = await request.json();
    
    const env = getEnvironment();
    const prefix = env === 'prod' ? '/PracticeTools' : `/PracticeTools/${env}`;
    
    // Store sensitive data in SSM
    const ssmUpdates = [];
    if (webexClientId) {
      ssmUpdates.push(putSSMParameter(`${prefix}/WEBEX_MEETINGS_CLIENT_ID`, webexClientId));
    }
    if (webexClientSecret && webexClientSecret !== '••••••••') {
      ssmUpdates.push(putSSMParameter(`${prefix}/WEBEX_MEETINGS_CLIENT_SECRET`, webexClientSecret));
    }
    
    // Store non-sensitive data in database
    const tableName = getTableName('settings');
    await ensureTableExists(tableName);
    
    const putCommand = new PutItemCommand({
      TableName: tableName,
      Item: {
        setting_key: { S: 'webex_meetings' },
        setting_value: { S: JSON.stringify({ webexSiteUrl, webexEnabled }) },
        updated_at: { S: new Date().toISOString() }
      }
    });
    
    await Promise.all([...ssmUpdates, dynamoClient.send(putCommand)]);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving Webex Meetings settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}