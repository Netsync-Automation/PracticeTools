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
  try {
    const payload = await request.json();
    await logWebhookEvent('received', 'info', { payload });
    
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
    console.error('Webhook processing error:', error);
    await logWebhookEvent('error', 'error', { error: error.message, stack: error.stack });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
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
    
    // Get transcript
    let transcript = '';
    if (recording.meetingId) {
      try {
        await logWebhookEvent('fetch_transcript', 'info', { meetingId: recording.meetingId });
        const transcriptResponse = await fetch(`https://webexapis.com/v1/meetingTranscripts?meetingId=${recording.meetingId}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (transcriptResponse.ok) {
          const transcriptData = await transcriptResponse.json();
          if (transcriptData.items?.length > 0) {
            const transcriptDetailResponse = await fetch(`https://webexapis.com/v1/meetingTranscripts/${transcriptData.items[0].id}/download`, {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            
            if (transcriptDetailResponse.ok) {
              transcript = await transcriptDetailResponse.text();
              await logWebhookEvent('transcript_downloaded', 'success', { meetingId: recording.meetingId });
            }
          }
        }
      } catch (error) {
        await logWebhookEvent('transcript_error', 'warning', { meetingId: recording.meetingId, error: error.message });
      }
    }
    
    // Store meeting data
    await logWebhookEvent('store_meeting', 'info', { meetingId: recording.meetingId || recordingId });
    await storeMeetingData({
      meetingId: recording.meetingId || recordingId,
      startTime: recording.timeRecorded || new Date().toISOString(),
      host: hostEmail,
      participants: recording.participants || [],
      recordingUrl: recording.downloadUrl,
      recordingData,
      transcript,
      duration: recording.durationSeconds
    });
    
    await logWebhookEvent('meeting_stored', 'success', { meetingId: recording.meetingId || recordingId });
    console.log(`Stored meeting data for ${recording.meetingId || recordingId}`);
  } catch (error) {
    await logWebhookEvent('processing_error', 'error', { recordingId, error: error.message, stack: error.stack });
    console.error('Error processing recording:', error);
  }
}