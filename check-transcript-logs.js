import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getTableName } from './lib/dynamodb.js';

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function checkTranscriptLogs() {
  try {
    const tableName = getTableName('webex_logs');
    const response = await docClient.send(new ScanCommand({
      TableName: tableName,
      FilterExpression: '#ts > :since',
      ExpressionAttributeNames: { '#ts': 'timestamp' },
      ExpressionAttributeValues: { ':since': new Date(Date.now() - 2*60*60*1000).toISOString() }
    }));
    
    const logs = response.Items?.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)) || [];
    
    console.log(`Found ${logs.length} recent logs:`);
    logs.forEach(log => {
      console.log(`[${log.timestamp}] ${log.event} - ${log.status}`);
      if (log.event.includes('transcript') || log.details?.transcriptId) {
        console.log('  📝 TRANSCRIPT LOG:', JSON.stringify(log.details, null, 2));
      }
      if (log.event === 'fetch_transcript' || log.event === 'transcript_downloaded' || log.event === 'transcript_error') {
        console.log('  🔍 TRANSCRIPT DETAILS:', JSON.stringify(log.details, null, 2));
      }
    });
  } catch (error) {
    console.error('Error checking logs:', error);
  }
}

checkTranscriptLogs();