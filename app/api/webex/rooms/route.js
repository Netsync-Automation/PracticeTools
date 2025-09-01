import { NextResponse } from 'next/server';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

export const dynamic = 'force-dynamic';

const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

async function getSSMParameter(name) {
  try {
    const command = new GetParameterCommand({
      Name: name,
      WithDecryption: true
    });
    const response = await ssmClient.send(command);
    return response.Parameter?.Value;
  } catch (error) {
    console.error(`Error getting SSM parameter ${name}:`, error);
    return null;
  }
}

export async function GET(request) {
  try {
    // Get WebEx token from SSM using correct parameter name
    const ENV = process.env.ENVIRONMENT || 'prod';
    const tokenParam = ENV === 'prod' ? '/PracticeTools/WEBEX_SCOOP_ACCESS_TOKEN' : `/PracticeTools/${ENV}/WEBEX_SCOOP_ACCESS_TOKEN`;
    const token = await getSSMParameter(tokenParam);
    
    if (!token) {
      return NextResponse.json({ error: 'WebEx token not configured' }, { status: 400 });
    }

    // Fetch rooms from WebEx API
    const response = await fetch('https://webexapis.com/v1/rooms', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch rooms from WebEx' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({ rooms: data.items || [] });

  } catch (error) {
    console.error('WebEx rooms API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { token, roomId } = await request.json();

    const ENV = process.env.ENVIRONMENT || 'prod';
    
    if (token) {
      // Save token to SSM using correct parameter name
      const { PutParameterCommand } = await import('@aws-sdk/client-ssm');
      const tokenParam = ENV === 'prod' ? '/PracticeTools/WEBEX_SCOOP_ACCESS_TOKEN' : `/PracticeTools/${ENV}/WEBEX_SCOOP_ACCESS_TOKEN`;
      const command = new PutParameterCommand({
        Name: tokenParam,
        Value: token,
        Type: 'String',
        Overwrite: true
      });
      await ssmClient.send(command);
    }

    if (roomId) {
      // Save room ID to SSM using correct parameter name
      const { PutParameterCommand } = await import('@aws-sdk/client-ssm');
      const roomIdParam = ENV === 'prod' ? '/PracticeTools/WEBEX_SCOOP_ROOM_ID_1' : `/PracticeTools/${ENV}/WEBEX_SCOOP_ROOM_ID_1`;
      const command = new PutParameterCommand({
        Name: roomIdParam,
        Value: roomId,
        Type: 'String',
        Overwrite: true
      });
      await ssmClient.send(command);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('WebEx settings save error:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}