import { NextResponse } from 'next/server';
import { SSMClient, GetParameterCommand, PutParameterCommand } from '@aws-sdk/client-ssm';
import { getEnvironment } from '../../../../lib/dynamodb';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

async function getAccessToken() {
  const env = getEnvironment();
  const prefix = env === 'prod' ? '/PracticeTools' : `/PracticeTools/${env}`;
  
  try {
    const command = new GetParameterCommand({
      Name: `${prefix}/WEBEX_MEETINGS_ACCESS_TOKEN`,
      WithDecryption: true
    });
    const response = await ssmClient.send(command);
    return response.Parameter?.Value;
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
}

export async function POST(request) {
  try {
    const { action } = await request.json();
    const accessToken = await getAccessToken();
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Access token not configured' }, { status: 400 });
    }
    
    const baseUrl = request.headers.get('host') ? `https://${request.headers.get('host')}` : 'https://your-domain.com';
    
    if (action === 'create') {
      const webhooks = [
        {
          name: 'PracticeTools Recordings Webhook',
          targetUrl: `${baseUrl}/api/webex-meetings/webhook`,
          resource: 'recordings',
          event: 'created'
        },
        {
          name: 'PracticeTools Transcripts Webhook', 
          targetUrl: `${baseUrl}/api/webex-meetings/webhook`,
          resource: 'meetingTranscripts',
          event: 'created'
        }
      ];
      
      const results = [];
      for (const webhook of webhooks) {
        try {
          const response = await fetch('https://webexapis.com/v1/webhooks', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(webhook)
          });
          
          const data = await response.json();
          results.push({ webhook: webhook.name, success: response.ok, data });
        } catch (error) {
          results.push({ webhook: webhook.name, success: false, error: error.message });
        }
      }
      
      return NextResponse.json({ success: true, results });
    }
    
    if (action === 'list') {
      const response = await fetch('https://webexapis.com/v1/webhooks', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      const data = await response.json();
      return NextResponse.json(data);
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Webhook management error:', error);
    return NextResponse.json({ error: 'Failed to manage webhooks' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { webhookId } = await request.json();
    const accessToken = await getAccessToken();
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Access token not configured' }, { status: 400 });
    }
    
    const response = await fetch(`https://webexapis.com/v1/webhooks/${webhookId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    return NextResponse.json({ success: response.ok });
  } catch (error) {
    console.error('Webhook deletion error:', error);
    return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 });
  }
}