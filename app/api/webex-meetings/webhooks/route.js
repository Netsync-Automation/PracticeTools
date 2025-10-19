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
      
      // Check existing webhooks first
      const existingResponse = await fetch('https://webexapis.com/v1/webhooks', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      const existingData = await existingResponse.json();
      const existingWebhooks = existingData.items || [];
      
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
          resource: 'meeting_transcripts',
          event: 'updated'
        }
      ];
      
      const results = [];
      for (const webhook of webhooks) {
        // Check if webhook already exists
        const existing = existingWebhooks.find(w => 
          w.resource === webhook.resource && 
          w.event === webhook.event &&
          w.targetUrl.includes('/api/webex-meetings/webhook')
        );
        
        if (existing) {
          console.log(`[WEBHOOKS] ${webhook.name} already exists:`, existing.id);
          results.push({ 
            webhook: webhook.name, 
            success: true, 
            status: 'already_exists',
            data: existing 
          });
          continue;
        }
        
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
          results.push({ 
            webhook: webhook.name, 
            success: response.ok, 
            status: response.ok ? 'created' : 'failed',
            data 
          });
        } catch (error) {
          console.log('[WEBHOOKS] Webhook creation error:', error.message);
          results.push({ webhook: webhook.name, success: false, status: 'error', error: error.message });
        }
      }
      
      return NextResponse.json({ success: true, results });
    }
    
    if (action === 'delete-transcript') {
      console.log('[WEBHOOKS] Deleting transcript webhook only');
      
      const existingResponse = await fetch('https://webexapis.com/v1/webhooks', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      const existingData = await existingResponse.json();
      const existingWebhooks = existingData.items || [];
      
      const transcriptWebhook = existingWebhooks.find(w => 
        (w.resource === 'meeting_transcripts' || w.resource === 'meetingTranscripts') && 
        (w.event === 'updated' || w.event === 'created')
      );
      
      if (!transcriptWebhook) {
        return NextResponse.json({ success: false, error: 'No transcript webhook found to delete' });
      }
      
      console.log('[WEBHOOKS] Deleting transcript webhook:', transcriptWebhook.id);
      try {
        const deleteResponse = await fetch(`https://webexapis.com/v1/webhooks/${transcriptWebhook.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        return NextResponse.json({ 
          success: deleteResponse.ok,
          webhook: transcriptWebhook,
          status: deleteResponse.status
        });
      } catch (error) {
        return NextResponse.json({ success: false, error: error.message });
      }
    }
    
    if (action === 'recreate-transcript') {
      console.log('[WEBHOOKS] Recreating transcript webhook only');
      
      // First, find and delete existing transcript webhook
      const existingResponse = await fetch('https://webexapis.com/v1/webhooks', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      const existingData = await existingResponse.json();
      const existingWebhooks = existingData.items || [];
      
      const transcriptWebhook = existingWebhooks.find(w => 
        (w.resource === 'meeting_transcripts' || w.resource === 'meetingTranscripts') && 
        (w.event === 'updated' || w.event === 'created')
      );
      
      const results = [];
      
      // Delete existing transcript webhook if found
      if (transcriptWebhook) {
        console.log('[WEBHOOKS] Deleting existing transcript webhook:', transcriptWebhook.id);
        try {
          const deleteResponse = await fetch(`https://webexapis.com/v1/webhooks/${transcriptWebhook.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          
          results.push({
            action: 'delete',
            webhook: 'PracticeTools Transcripts Webhook',
            success: deleteResponse.ok,
            status: deleteResponse.status
          });
        } catch (error) {
          results.push({
            action: 'delete',
            webhook: 'PracticeTools Transcripts Webhook',
            success: false,
            error: error.message
          });
        }
      }
      
      // Create new transcript webhook
      const newWebhook = {
        name: 'PracticeTools Transcripts Webhook',
        targetUrl: `${baseUrl}/api/webex-meetings/webhook`,
        resource: 'meeting_transcripts',
        event: 'updated'
      };
      
      console.log('[WEBHOOKS] Creating new transcript webhook');
      try {
        const createResponse = await fetch('https://webexapis.com/v1/webhooks', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(newWebhook)
        });
        
        const createData = await createResponse.json();
        results.push({
          action: 'create',
          webhook: 'PracticeTools Transcripts Webhook',
          success: createResponse.ok,
          status: createResponse.status,
          data: createData
        });
      } catch (error) {
        results.push({
          action: 'create',
          webhook: 'PracticeTools Transcripts Webhook',
          success: false,
          error: error.message
        });
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