import { NextResponse } from 'next/server';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getTableName } from '../../../../lib/dynamodb';

export const dynamic = 'force-dynamic';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function getMonitoredHosts() {
  try {
    const tableName = getTableName('webex_hosts');
    
    const command = new ScanCommand({
      TableName: tableName
    });
    
    const response = await docClient.send(command);
    const hosts = response.Items || [];
    return hosts.map(h => h.email);
  } catch (error) {
    console.error('Error getting monitored hosts:', error);
    return [];
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();
    
    // Log webhook for debugging
    console.log('Webex webhook received:', JSON.stringify(payload, null, 2));
    
    // Get monitored hosts
    const monitoredHosts = await getMonitoredHosts();
    
    // Handle different event types
    const { resource, event, data } = payload;
    
    // Filter events to only process monitored hosts
    const hostEmail = data?.hostEmail;
    if (!hostEmail || !monitoredHosts.includes(hostEmail)) {
      console.log(`Ignoring event for non-monitored host: ${hostEmail}`);
      return NextResponse.json({ success: true, message: 'Host not monitored' });
    }
    
    if (resource === 'recordings' && (event === 'created' || event === 'updated')) {
      await handleRecordingEvent(data);
    } else if (resource === 'meetingTranscripts' && (event === 'created' || event === 'updated')) {
      await handleTranscriptEvent(data);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handleRecordingEvent(data) {
  try {
    const tableName = getTableName('webex_recordings');
    
    const putCommand = new PutItemCommand({
      TableName: tableName,
      Item: {
        recording_id: { S: data.id },
        meeting_id: { S: data.meetingId || 'unknown' },
        host_email: { S: data.hostEmail || 'unknown' },
        topic: { S: data.topic || 'Unknown Meeting' },
        start_time: { S: data.timeRecorded || new Date().toISOString() },
        download_url: { S: data.downloadUrl || '' },
        status: { S: 'available' },
        webhook_received: { S: new Date().toISOString() },
        processed: { BOOL: false }
      }
    });
    
    await dynamoClient.send(putCommand);
    console.log('Recording event stored:', data.id);
  } catch (error) {
    console.error('Error storing recording event:', error);
  }
}

async function handleTranscriptEvent(data) {
  try {
    const tableName = getTableName('webex_transcripts');
    
    const putCommand = new PutItemCommand({
      TableName: tableName,
      Item: {
        transcript_id: { S: data.id },
        meeting_id: { S: data.meetingId || 'unknown' },
        host_email: { S: data.hostEmail || 'unknown' },
        download_url: { S: data.downloadUrl || '' },
        status: { S: 'available' },
        webhook_received: { S: new Date().toISOString() },
        processed: { BOOL: false }
      }
    });
    
    await dynamoClient.send(putCommand);
    console.log('Transcript event stored:', data.id);
  } catch (error) {
    console.error('Error storing transcript event:', error);
  }
}