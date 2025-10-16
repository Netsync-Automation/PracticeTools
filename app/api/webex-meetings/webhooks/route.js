import { NextResponse } from 'next/server';
import { getValidAccessToken } from '../../../../lib/webex-token-manager';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  console.log('[WEBHOOKS] POST request received');
  try {
    const { action } = await request.json();
    console.log('[WEBHOOKS] Action requested:', action);
    
    console.log('[WEBHOOKS] Getting access token...');
    const accessToken = await getValidAccessToken();
    console.log('[WEBHOOKS] Access token obtained:', !!accessToken);
    
    if (!accessToken) {
      console.log('[WEBHOOKS] No access token available');
      return NextResponse.json({ error: 'Access token not configured' }, { status: 400 });
    }
    
    const baseUrl = request.headers.get('host') ? `https://${request.headers.get('host')}` : 'https://your-domain.com';
    
    if (action === 'create') {
      console.log('[WEBHOOKS] Creating webhooks, baseUrl:', baseUrl);
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
        console.log('[WEBHOOKS] Creating webhook:', webhook.name);
        try {
          const response = await fetch('https://webexapis.com/v1/webhooks', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(webhook)
          });
          
          console.log('[WEBHOOKS] Webhook response status:', response.status);
          const data = await response.json();
          console.log('[WEBHOOKS] Webhook response data:', data);
          results.push({ webhook: webhook.name, success: response.ok, data });
        } catch (error) {
          console.log('[WEBHOOKS] Webhook creation error:', error.message);
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
    console.error('[WEBHOOKS] Webhook management error:', error);
    console.error('[WEBHOOKS] Error stack:', error.stack);
    return NextResponse.json({ error: 'Failed to manage webhooks: ' + error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { webhookId } = await request.json();
    const accessToken = await getValidAccessToken();
    
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