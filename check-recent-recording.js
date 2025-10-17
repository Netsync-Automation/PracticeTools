import { DynamoDBClient, ScanCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { getEnvironment, getTableName } from './lib/dynamodb.js';

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });

async function checkRecentRecording() {
  console.log('=== CHECKING RECENT RECORDING PROCESSING ===');
  
  // Check webhook logs (last 10 events)
  console.log('\n1. Recent Webhook Events:');
  try {
    const logsTable = getTableName('WebexMeetingsLogs');
    const logsResponse = await dynamoClient.send(new ScanCommand({
      TableName: logsTable,
      Limit: 10,
      ScanIndexForward: false
    }));
    
    if (logsResponse.Items && logsResponse.Items.length > 0) {
      logsResponse.Items
        .sort((a, b) => new Date(b.timestamp.S) - new Date(a.timestamp.S))
        .slice(0, 5)
        .forEach((item, i) => {
          const timestamp = new Date(item.timestamp.S).toLocaleString();
          const event = item.event?.S || 'unknown';
          const status = item.status?.S || 'unknown';
          const recordingId = item.details?.M?.recordingId?.S || 'N/A';
          const hostEmail = item.details?.M?.hostEmail?.S || 'N/A';
          
          console.log(`${i + 1}. [${timestamp}] ${event} - ${status}`);
          console.log(`   Recording: ${recordingId}`);
          console.log(`   Host: ${hostEmail}`);
        });
    } else {
      console.log('No webhook events found');
    }
  } catch (error) {
    console.log('Error checking webhook logs:', error.message);
  }
  
  // Check recordings table (last 5 recordings)
  console.log('\n2. Recent Recordings in Database:');
  try {
    const recordingsTable = getTableName('WebexRecordings');
    const recordingsResponse = await dynamoClient.send(new ScanCommand({
      TableName: recordingsTable,
      Limit: 5
    }));
    
    if (recordingsResponse.Items && recordingsResponse.Items.length > 0) {
      recordingsResponse.Items
        .sort((a, b) => new Date(b.created_at?.S || b.timeCreated?.S) - new Date(a.created_at?.S || a.timeCreated?.S))
        .forEach((item, i) => {
          const title = item.topic?.S || item.title?.S || 'No title';
          const hostEmail = item.hostEmail?.S || 'No host';
          const recordingId = item.id?.S || item.recordingId?.S || 'No ID';
          const created = item.created_at?.S || item.timeCreated?.S || 'No date';
          
          console.log(`${i + 1}. ${title}`);
          console.log(`   Host: ${hostEmail}`);
          console.log(`   ID: ${recordingId}`);
          console.log(`   Created: ${new Date(created).toLocaleString()}`);
        });
    } else {
      console.log('No recordings found in database');
    }
  } catch (error) {
    console.log('Error checking recordings:', error.message);
  }
  
  console.log('\n=== CHECK COMPLETE ===');
}

checkRecentRecording().catch(console.error);