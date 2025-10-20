import { NextResponse } from 'next/server';
import { SSMClient, GetParameterCommand, PutParameterCommand } from '@aws-sdk/client-ssm';
import { getEnvironment } from '../../../../lib/dynamodb.js';

const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

function getParameterName(paramName) {
  const env = getEnvironment();
  return env === 'prod' ? `/PracticeTools/${paramName}` : `/PracticeTools/${env}/${paramName}`;
}

export async function GET() {
  try {
    const [serviceAppIdParam, keyIdParam, privateKeyParam] = await Promise.all([
      ssmClient.send(new GetParameterCommand({ Name: getParameterName('WEBEX_SERVICE_APP_ID') })).catch(() => null),
      ssmClient.send(new GetParameterCommand({ Name: getParameterName('WEBEX_SERVICE_APP_KEY_ID') })).catch(() => null),
      ssmClient.send(new GetParameterCommand({ Name: getParameterName('WEBEX_SERVICE_APP_PRIVATE_KEY') })).catch(() => null)
    ]);

    return NextResponse.json({
      webexServiceAppId: serviceAppIdParam?.Parameter?.Value || '',
      webexServiceAppKeyId: keyIdParam?.Parameter?.Value || '',
      webexServiceAppPrivateKey: privateKeyParam?.Parameter?.Value ? '••••••••' : '',
      webexEnabled: true
    });
  } catch (error) {
    console.error('Error loading Service App settings:', error);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { webexServiceAppId, webexServiceAppKeyId, webexServiceAppPrivateKey, webexEnabled } = await request.json();

    const updates = [];

    if (webexServiceAppId) {
      updates.push(
        ssmClient.send(new PutParameterCommand({
          Name: getParameterName('WEBEX_SERVICE_APP_ID'),
          Value: webexServiceAppId,
          Type: 'String',
          Overwrite: true
        }))
      );
    }

    if (webexServiceAppKeyId) {
      updates.push(
        ssmClient.send(new PutParameterCommand({
          Name: getParameterName('WEBEX_SERVICE_APP_KEY_ID'),
          Value: webexServiceAppKeyId,
          Type: 'String',
          Overwrite: true
        }))
      );
    }

    if (webexServiceAppPrivateKey && webexServiceAppPrivateKey !== '••••••••') {
      updates.push(
        ssmClient.send(new PutParameterCommand({
          Name: getParameterName('WEBEX_SERVICE_APP_PRIVATE_KEY'),
          Value: webexServiceAppPrivateKey,
          Type: 'SecureString',
          Overwrite: true
        }))
      );
    }

    await Promise.all(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving Service App settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}