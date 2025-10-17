import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getEnvironment, getTableName } from './dynamodb.js';
import { createWebexMeetingsTable } from './create-tables.js';

const client = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

async function storeMeetingData(meetingData) {
  await createWebexMeetingsTable();
  const tableName = getTableName('webex_meetings');
  
  const item = {
    meetingId: meetingData.meetingId,
    meetingInstanceId: meetingData.meetingInstanceId,
    startTime: meetingData.startTime,
    host: meetingData.host,
    participants: meetingData.participants,
    recordingUrl: meetingData.recordingUrl,
    recordingPassword: meetingData.recordingPassword,
    recordingData: meetingData.recordingData, // Base64 encoded MP4
    transcript: {
      text: meetingData.transcript,
      chunks: chunkTranscript(meetingData.transcript), // For AI processing
      metadata: {
        wordCount: meetingData.transcript.split(' ').length,
        duration: meetingData.duration || null,
        language: 'en'
      }
    },
    createdAt: new Date().toISOString(),
    environment: getEnvironment()
  };

  await docClient.send(new PutCommand({
    TableName: tableName,
    Item: item
  }));

  return item;
}

function chunkTranscript(transcript) {
  // Split transcript into semantic chunks for AI processing
  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const chunks = [];
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > 500) {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? '. ' : '') + sentence;
    }
  }
  
  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}

async function getMeetings() {
  await createWebexMeetingsTable();
  const tableName = getTableName('webex_meetings');
  
  const result = await docClient.send(new ScanCommand({
    TableName: tableName,
    FilterExpression: '#env = :env',
    ExpressionAttributeNames: { '#env': 'environment' },
    ExpressionAttributeValues: { ':env': getEnvironment() }
  }));

  return result.Items || [];
}

export { storeMeetingData, getMeetings };