import { NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getTableName } from '../../../../lib/dynamodb';
import { storeMeetingData } from '../../../../lib/meeting-storage';

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

export async function POST(request) {
  try {
    const payload = await request.json();
    
    if (payload.challenge) {
      return NextResponse.json({ challenge: payload.challenge });
    }
    
    const { resource, event, data } = payload;
    const hostEmail = data?.hostEmail;
    
    if (!hostEmail || !(await getMonitoredHosts()).includes(hostEmail)) {
      return NextResponse.json({ success: true, message: 'Host not monitored' });
    }
    
    if (resource === 'recordings' && event === 'created') {
      await processRecording(data.id, hostEmail, data);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function processRecording(recordingId, hostEmail, eventData) {
  try {
    const accessToken = process.env.WEBEX_MEETINGS_ACCESS_TOKEN;
    if (!accessToken) throw new Error('No Webex access token');
    
    // Get recording details
    const recordingResponse = await fetch(`https://webexapis.com/v1/recordings/${recordingId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!recordingResponse.ok) throw new Error(`Failed to fetch recording: ${recordingResponse.status}`);
    const recording = await recordingResponse.json();
    
    // Download recording file
    let recordingData = null;
    if (recording.downloadUrl) {
      const downloadResponse = await fetch(recording.downloadUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (downloadResponse.ok) {
        const buffer = await downloadResponse.arrayBuffer();
        recordingData = Buffer.from(buffer).toString('base64');
      }
    }
    
    // Get transcript
    let transcript = '';
    if (recording.meetingId) {
      try {
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
            }
          }
        }
      } catch (error) {
        console.log('Transcript not available:', error.message);
      }
    }
    
    // Store meeting data
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
    
    console.log(`Stored meeting data for ${recording.meetingId || recordingId}`);
  } catch (error) {
    console.error('Error processing recording:', error);
  }
}