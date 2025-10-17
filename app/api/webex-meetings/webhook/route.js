import { NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { getTableName } from '../../../../lib/dynamodb';
import { storeMeetingData, updateMeetingTranscript } from '../../../../lib/meeting-storage';
import { getValidAccessToken } from '../../../../lib/webex-token-manager';
import { createWebexLogsTable } from '../../../../lib/create-tables';
import { uploadRecordingToS3 } from '../../../../lib/s3-storage';

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
    
    await logWebhookEvent('processing', 'info', { resource, event, dataId: data?.id, id });
    
    if (resource === 'recordings' && event === 'created') {
      const hostUserId = data?.hostUserId;
      
      if (!hostUserId) {
        await logWebhookEvent('filtered', 'info', { reason: 'No hostUserId in recording webhook', data });
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
      
      await logWebhookEvent('processing_recording', 'info', { recordingId: data.id, hostEmail });
      await processRecording(data.id, hostEmail, data);
    } else if (resource === 'meetingTranscripts' && event === 'created') {
      // Transcript webhooks don't have hostUserId, process directly
      await logWebhookEvent('processing_transcript', 'info', { transcriptId: data.id });
      await processTranscript(data.id, data);
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
    
    // Download recording file and upload to S3
    let s3Key = null;
    const recordingDownloadUrl = recording.temporaryDirectDownloadLinks?.recordingDownloadLink;
    if (recordingDownloadUrl) {
      await logWebhookEvent('download_recording', 'info', { recordingId });
      const downloadResponse = await fetch(recordingDownloadUrl);
      
      if (downloadResponse.ok) {
        const buffer = await downloadResponse.arrayBuffer();
        const filename = `${recording.topic || 'recording'}-${recordingId}.mp4`;
        
        // Upload to S3
        s3Key = await uploadRecordingToS3(recordingId, Buffer.from(buffer), filename);
        await logWebhookEvent('recording_uploaded_s3', 'success', { recordingId, s3Key, size: buffer.byteLength });
      } else {
        await logWebhookEvent('download_error', 'error', { recordingId, status: downloadResponse.status });
      }
    }
    
    // Store meeting data (without transcript)
    await logWebhookEvent('store_meeting', 'info', { meetingId: recording.meetingId || recordingId });
    await storeMeetingData({
      meetingId: recording.meetingId || recordingId,
      meetingInstanceId: recording.meetingId,
      startTime: recording.timeRecorded || new Date().toISOString(),
      host: hostEmail,
      participants: recording.participants || [],
      recordingUrl: recording.playbackUrl || recording.downloadUrl,
      recordingPassword: recording.password,
      s3Key,
      transcript: '', // Empty - will be updated by transcript webhook
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

async function processTranscript(transcriptId, eventData) {
  try {
    await logWebhookEvent('transcript_webhook_start', 'info', { transcriptId, eventData });
    
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      await logWebhookEvent('token_error_transcript', 'error', { transcriptId });
      throw new Error('No Webex access token');
    }
    
    // Get transcript details to find meetingId
    await logWebhookEvent('fetch_transcript_details', 'info', { transcriptId, url: `https://webexapis.com/v1/meetingTranscripts/${transcriptId}` });
    const transcriptResponse = await fetch(`https://webexapis.com/v1/meetingTranscripts/${transcriptId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!transcriptResponse.ok) {
      const errorText = await transcriptResponse.text();
      await logWebhookEvent('fetch_transcript_error', 'error', { transcriptId, status: transcriptResponse.status, error: errorText });
      throw new Error(`Failed to fetch transcript: ${transcriptResponse.status}`);
    }
    
    const transcriptData = await transcriptResponse.json();
    const endedInstanceId = transcriptData.meetingId;
    
    await logWebhookEvent('transcript_details_received', 'info', { 
      transcriptId, 
      endedInstanceId, 
      transcriptDataKeys: Object.keys(transcriptData),
      fullTranscriptData: transcriptData 
    });
    
    // Use ended meeting instance ID to get transcripts (working method)
    let transcript = '';
    if (endedInstanceId && endedInstanceId.includes('_I_')) {
      await logWebhookEvent('fetching_transcript_list', 'info', { endedInstanceId, url: `https://webexapis.com/v1/meetingTranscripts?meetingId=${endedInstanceId}` });
      
      const transcriptListResponse = await fetch(`https://webexapis.com/v1/meetingTranscripts?meetingId=${endedInstanceId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (transcriptListResponse.ok) {
        const transcriptListData = await transcriptListResponse.json();
        await logWebhookEvent('transcript_list_received', 'info', { 
          endedInstanceId, 
          itemCount: transcriptListData.items?.length || 0,
          transcriptListData 
        });
        
        if (transcriptListData.items?.length > 0) {
          const transcriptItem = transcriptListData.items[0];
          const downloadUrl = transcriptItem.vttDownloadLink || transcriptItem.txtDownloadLink;
          
          await logWebhookEvent('transcript_download_attempt', 'info', { 
            transcriptId, 
            downloadUrl, 
            hasVtt: !!transcriptItem.vttDownloadLink,
            hasTxt: !!transcriptItem.txtDownloadLink,
            transcriptItem 
          });
          
          if (downloadUrl) {
            const downloadResponse = await fetch(downloadUrl, {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            
            if (downloadResponse.ok) {
              transcript = await downloadResponse.text();
              await logWebhookEvent('transcript_downloaded', 'success', { 
                transcriptId, 
                transcriptLength: transcript.length,
                transcriptPreview: transcript.substring(0, 200) 
              });
            } else {
              const downloadError = await downloadResponse.text();
              await logWebhookEvent('transcript_download_failed', 'error', { 
                transcriptId, 
                status: downloadResponse.status,
                error: downloadError 
              });
            }
          } else {
            await logWebhookEvent('no_download_url', 'warning', { transcriptId, transcriptItem });
          }
        } else {
          await logWebhookEvent('no_transcript_items', 'warning', { endedInstanceId, transcriptListData });
        }
      } else {
        const listError = await transcriptListResponse.text();
        await logWebhookEvent('transcript_list_failed', 'error', { 
          endedInstanceId, 
          status: transcriptListResponse.status,
          error: listError 
        });
      }
    } else {
      await logWebhookEvent('invalid_instance_id', 'warning', { 
        transcriptId, 
        endedInstanceId, 
        hasInstanceId: !!endedInstanceId,
        containsI: endedInstanceId?.includes('_I_') 
      });
    }
    
    // Update existing meeting record with transcript
    if (transcript && endedInstanceId) {
      await logWebhookEvent('updating_meeting_transcript', 'info', { meetingId: endedInstanceId, transcriptId, transcriptLength: transcript.length });
      
      try {
        await updateMeetingTranscript(endedInstanceId, transcript);
        await logWebhookEvent('transcript_updated', 'success', { meetingId: endedInstanceId, transcriptId });
        console.log(`Updated transcript for meeting ${endedInstanceId}`);
      } catch (updateError) {
        await logWebhookEvent('transcript_update_db_error', 'error', { 
          meetingId: endedInstanceId, 
          transcriptId, 
          error: updateError.message,
          stack: updateError.stack 
        });
      }
    } else {
      await logWebhookEvent('transcript_update_skipped', 'warning', { 
        meetingId: endedInstanceId, 
        transcriptId, 
        hasTranscript: !!transcript,
        hasEndedInstanceId: !!endedInstanceId,
        transcriptLength: transcript?.length || 0 
      });
    }
  } catch (error) {
    await logWebhookEvent('transcript_processing_error', 'error', { 
      transcriptId, 
      error: error.message, 
      stack: error.stack,
      errorName: error.name 
    });
    console.error('Error processing transcript:', error);
  }
}