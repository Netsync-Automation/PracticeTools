import { NextResponse } from 'next/server';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { getEnvironment } from '../../../../lib/dynamodb';

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
    return null;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const meetingId = searchParams.get('meetingId');
    
    if (!meetingId) {
      return NextResponse.json({ error: 'meetingId parameter required' }, { status: 400 });
    }
    
    const env = getEnvironment();
    const prefix = env === 'prod' ? '/PracticeTools' : `/PracticeTools/${env}`;
    
    const accessToken = await getSSMParameter(`${prefix}/WEBEX_MEETINGS_ACCESS_TOKEN`);
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Webex access token not configured' }, { status: 401 });
    }
    
    const response = await fetch(`https://webexapis.com/v1/meetingTranscripts?meetingId=${meetingId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json({ error: 'Access token expired or invalid' }, { status: 401 });
      }
      return NextResponse.json({ error: 'Failed to fetch transcripts' }, { status: response.status });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error fetching transcripts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}