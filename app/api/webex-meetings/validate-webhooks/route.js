import { NextResponse } from 'next/server';
import { getValidAccessToken } from '../../../../lib/webex-token-manager';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: 'Access token not configured' }, { status: 400 });
    }
    
    const response = await fetch('https://webexapis.com/v1/webhooks', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch webhooks' }, { status: response.status });
    }
    
    const data = await response.json();
    const webhooks = data.items || [];
    
    // Check for required webhooks
    const recordingsWebhook = webhooks.find(w => 
      w.resource === 'recordings' && 
      w.event === 'created' && 
      w.targetUrl.includes('/api/webex-meetings/webhook')
    );
    
    const transcriptsWebhook = webhooks.find(w => 
      w.resource === 'meetingTranscripts' && 
      w.event === 'created' && 
      w.targetUrl.includes('/api/webex-meetings/webhook')
    );
    
    const validation = {
      totalWebhooks: webhooks.length,
      recordingsWebhook: recordingsWebhook ? {
        id: recordingsWebhook.id,
        name: recordingsWebhook.name,
        targetUrl: recordingsWebhook.targetUrl,
        status: recordingsWebhook.status,
        created: recordingsWebhook.created
      } : null,
      transcriptsWebhook: transcriptsWebhook ? {
        id: transcriptsWebhook.id,
        name: transcriptsWebhook.name,
        targetUrl: transcriptsWebhook.targetUrl,
        status: transcriptsWebhook.status,
        created: transcriptsWebhook.created
      } : null,
      isValid: !!(recordingsWebhook && transcriptsWebhook),
      allWebhooks: webhooks.map(w => ({
        id: w.id,
        name: w.name,
        resource: w.resource,
        event: w.event,
        targetUrl: w.targetUrl,
        status: w.status
      }))
    };
    
    return NextResponse.json(validation);
  } catch (error) {
    console.error('Webhook validation error:', error);
    return NextResponse.json({ error: 'Failed to validate webhooks' }, { status: 500 });
  }
}