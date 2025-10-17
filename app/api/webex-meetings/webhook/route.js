import { NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { getTableName } from '../../../../lib/dynamodb';
import { storeMeetingData } from '../../../../lib/meeting-storage';
import { getValidAccessToken } from '../../../../lib/webex-token-manager';
import { createWebexLogsTable } from '../../../../lib/create-tables';

export const dynamic = 'force-dynamic';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function getMonitoredHosts() {
  try {
    const tableName = getTableName('webex_hosts');
    const response = await docClient.send(new ScanCommand({ TableName: tableName }));
    return (response.Items || []).map(h => h.email);
  } catch (error) {
    console.error('Error getting monitored hosts:', error);
    return [];
  }
}

async function getHostEmailFromUserId(hostUserId, accessToken) {
  try {
    const response = await fetch(`https://webexapis.com/v1/people/${hostUserId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (response.ok) {
      const person = await response.json();
      return person.emails?.[0] || null;
    }
    return null;
  } catch (error) {
    console.error('Error fetching host email:', error);
    return null;
  }
}

async function logWebhookEvent(event, status, details) {
  try {
    await createWebexLogsTable();
    const tableName = getTableName('webex_logs');
    await docClient.send(new PutCommand({
      TableName: tableName,
      Item: {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        event,
        status,
        details,
        environment: process.env.ENVIRONMENT || 'dev'
      }
    }));
  } catch (error) {
    console.error('Failed to log webhook event:', error);
  }
}

export async function POST(request) {
  console.log('[WEBHOOK] Starting webhook processing');
  try {
    console.log('[WEBHOOK] Parsing request body');
    const payload = await request.json();
    console.log('[WEBHOOK] Payload received:', JSON.stringify(payload, null, 2));
    
    console.log('[WEBHOOK] Logging webhook event');
    await logWebhookEvent('received', 'info', { payload });
    console.log('[WEBHOOK] Event logged successfully');
    
    // Handle Webex webhook challenge (required for webhook verification)
    if (payload.challenge) {
      await logWebhookEvent('challenge', 'success', { challenge: payload.challenge });
      return NextResponse.json({ challenge: payload.challenge });
    }
    
    const { resource, event, data, id, name, targetUrl, created, actorId } = payload;
    const hostUserId = data?.hostUserId;
    
    await logWebhookEvent('processing', 'info', { resource, event, hostUserId, id });
    
    if (!hostUserId) {
      await logWebhookEvent('filtered', 'info', { reason: 'No hostUserId in webhook data', data });
      return NextResponse.json({ success: true, message: 'No hostUserId found' });
    }
    
    // Get access token to lookup host email
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      await logWebhookEvent('token_error', 'error', { hostUserId });
      return NextResponse.json({ error: 'No access token' }, { status: 500 });
    }
    
    // Lookup host email from hostUserId
    const hostEmail = await getHostEmailFromUserId(hostUserId, accessToken);
    await logWebhookEvent('host_lookup', 'info', { hostUserId, hostEmail });
    
    const monitoredHosts = await getMonitoredHosts();
    if (!hostEmail || !monitoredHosts.includes(hostEmail)) {
      await logWebhookEvent('filtered', 'info', { reason: 'Host not monitored', hostEmail, monitoredHosts });
      return NextResponse.json({ success: true, message: 'Host not monitored' });
    }
    
    if (resource === 'recordings' && event === 'created') {
      await logWebhookEvent('processing_recording', 'info', { recordingId: data.id, hostEmail });
      await processRecording(data.id, hostEmail, data);
    } else if (resource === 'meetingTranscripts' && event === 'created') {
      await logWebhookEvent('processing_transcript', 'info', { transcriptId: data.id, hostEmail });
      // Transcript processing handled in recording processing
    } else {
      await logWebhookEvent('unsupported_event', 'warning', { resource, event });
    }
    
    await logWebhookEvent('completed', 'success', { resource, event });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[WEBHOOK] Critical error:', error);
    console.error('[WEBHOOK] Error stack:', error.stack);
    console.error('[WEBHOOK] Error name:', error.name);
    console.error('[WEBHOOK] Error message:', error.message);
    
    try {
      await logWebhookEvent('error', 'error', { error: error.message, stack: error.stack });
    } catch (logError) {
      console.error('[WEBHOOK] Failed to log error:', logError);
    }
    
    return NextResponse.json({ 
      error: 'Webhook processing failed', 
      details: error.message,
      type: error.name 
    }, { status: 500 });
  }
}

async function processRecording(recordingId, hostEmail, eventData) {
  try {
    await logWebhookEvent('fetch_token', 'info', { recordingId });
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      await logWebhookEvent('token_error', 'error', { recordingId });
      throw new Error('No Webex access token');
    }
    
    // Get recording details
    await logWebhookEvent('fetch_recording', 'info', { recordingId });
    const recordingResponse = await fetch(`https://webexapis.com/v1/recordings/${recordingId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!recordingResponse.ok) {
      await logWebhookEvent('fetch_recording_error', 'error', { recordingId, status: recordingResponse.status });
      throw new Error(`Failed to fetch recording: ${recordingResponse.status}`);
    }
    const recording = await recordingResponse.json();
    await logWebhookEvent('recording_fetched', 'success', { recordingId, meetingId: recording.meetingId, hostEmail });
    
    // Debug: Log the full recording structure for transcript debugging
    await logWebhookEvent('recording_structure_debug', 'info', {
      recordingId,
      hasTemporaryDirectDownloadLinks: !!recording.temporaryDirectDownloadLinks,
      temporaryLinksKeys: recording.temporaryDirectDownloadLinks ? Object.keys(recording.temporaryDirectDownloadLinks) : [],
      transcriptLinkExists: !!recording.temporaryDirectDownloadLinks?.transcriptDownloadLink
    });
    
    // Download recording file
    let recordingData = null;
    if (recording.downloadUrl) {
      await logWebhookEvent('download_recording', 'info', { recordingId });
      const downloadResponse = await fetch(recording.downloadUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (downloadResponse.ok) {
        const buffer = await downloadResponse.arrayBuffer();
        recordingData = Buffer.from(buffer).toString('base64');
        await logWebhookEvent('recording_downloaded', 'success', { recordingId, size: buffer.byteLength });
      } else {
        await logWebhookEvent('download_error', 'error', { recordingId, status: downloadResponse.status });
      }
    }
    
    // Get transcript using direct download link or API
    let transcript = '';
    
    // Debug logging for transcript detection
    await logWebhookEvent('transcript_debug', 'info', {
      recordingId,
      hasTemporaryLinks: !!recording.temporaryDirectDownloadLinks,
      hasTranscriptLink: !!recording.temporaryDirectDownloadLinks?.transcriptDownloadLink,
      transcriptLinkLength: recording.temporaryDirectDownloadLinks?.transcriptDownloadLink?.length || 0
    });
    
    // Method 1: Try direct transcript download link first
    const directTranscriptUrl = recording.temporaryDirectDownloadLinks?.transcriptDownloadLink;
    if (directTranscriptUrl) {
      try {
        await logWebhookEvent('fetch_direct_transcript', 'info', { recordingId, directTranscriptUrl });
        const directResponse = await fetch(directTranscriptUrl);
        
        if (directResponse.ok) {
          transcript = await directResponse.text();
          await logWebhookEvent('direct_transcript_downloaded', 'success', { 
            recordingId, 
            transcriptLength: transcript.length 
          });
        } else {
          await logWebhookEvent('direct_transcript_failed', 'warning', { 
            recordingId, 
            status: directResponse.status 
          });
        }
      } catch (error) {
        await logWebhookEvent('direct_transcript_error', 'warning', { recordingId, error: error.message });
      }
    }
    
    // Method 2: If no direct link or direct download failed, try API method
    if (!transcript && recording.meetingId && recording.meetingId.includes('_I_')) {
      try {
        const endedInstanceId = recording.meetingId;
        await logWebhookEvent('fetch_transcript_api', 'info', { endedInstanceId });
        const transcriptResponse = await fetch(`https://webexapis.com/v1/meetingTranscripts?meetingId=${endedInstanceId}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (transcriptResponse.ok) {
          const transcriptData = await transcriptResponse.json();
          await logWebhookEvent('transcript_list_fetched', 'info', { 
            endedInstanceId, 
            transcriptCount: transcriptData.items?.length || 0 
          });
          
          if (transcriptData.items?.length > 0) {
            const transcriptItem = transcriptData.items[0];
            const downloadUrl = transcriptItem.vttDownloadLink || transcriptItem.txtDownloadLink;
            
            if (downloadUrl) {
              const transcriptDetailResponse = await fetch(downloadUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
              });
              
              if (transcriptDetailResponse.ok) {
                transcript = await transcriptDetailResponse.text();
                await logWebhookEvent('api_transcript_downloaded', 'success', { 
                  endedInstanceId, 
                  transcriptLength: transcript.length,
                  downloadUrl 
                });
              } else {
                await logWebhookEvent('api_transcript_download_failed', 'warning', { 
                  endedInstanceId, 
                  status: transcriptDetailResponse.status 
                });
              }
            } else {
              await logWebhookEvent('no_transcript_download_links', 'warning', { 
                endedInstanceId,
                transcriptItem 
              });
            }
          } else {
            await logWebhookEvent('no_transcripts_available', 'info', { 
              endedInstanceId,
              reason: 'No transcripts found for ended meeting instance'
            });
          }
        } else {
          const errorText = await transcriptResponse.text();
          await logWebhookEvent('transcript_api_failed', 'warning', { 
            endedInstanceId, 
            status: transcriptResponse.status,
            error: errorText 
          });
        }
      } catch (error) {
        await logWebhookEvent('transcript_api_error', 'warning', { endedInstanceId: recording.meetingId, error: error.message });
      }
    }
    
    // Log final transcript status
    if (!transcript) {
      await logWebhookEvent('no_transcript_found', 'info', { 
        recordingId,
        meetingId: recording.meetingId,
        hasDirectLink: !!directTranscriptUrl,
        hasEndedInstanceId: !!(recording.meetingId && recording.meetingId.includes('_I_'))
      });
    }
    
    // Store meeting data
    await logWebhookEvent('store_meeting', 'info', { meetingId: recording.meetingId || recordingId });
    await storeMeetingData({
      meetingId: recording.meetingId || recordingId,
      meetingInstanceId: recording.meetingId, // Use meetingId as it contains the instance ID
      startTime: recording.timeRecorded || new Date().toISOString(),
      host: hostEmail,
      participants: recording.participants || [],
      recordingUrl: recording.playbackUrl || recording.downloadUrl,
      recordingPassword: recording.password,
      recordingData,
      transcript,
      duration: recording.durationSeconds
    });
    
    await logWebhookEvent('meeting_stored', 'success', { 
      meetingId: recording.meetingId || recordingId,
      meetingInstanceId: recording.meetingInstanceId 
    });
    console.log(`Stored meeting data for ${recording.meetingId || recordingId}`);
  } catch (error) {
    await logWebhookEvent('processing_error', 'error', { recordingId, error: error.message, stack: error.stack });
    console.error('Error processing recording:', error);
  }
}