import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

function getTableName(baseName) {
  const env = process.env.ENVIRONMENT || 'dev';
  return `PracticeTools-${env}-${baseName}`;
}

async function checkWebhookLogs() {
  try {
    const tableName = getTableName('WebexMeetingsWebhookLogs');
    console.log('Checking webhook logs in table:', tableName);
    
    const command = new ScanCommand({
      TableName: tableName,
      Limit: 50
    });
    
    const result = await docClient.send(command);
    const logs = result.Items || [];
    
    console.log(`\n=== WEBHOOK LOGS (${logs.length} entries) ===\n`);
    
    if (logs.length === 0) {
      console.log('No webhook logs found.');
      return;
    }
    
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    const transcriptLogs = logs.filter(log => log.webhookType === 'transcripts');
    const recordingLogs = logs.filter(log => log.webhookType === 'recordings');
    
    console.log(`Transcript webhooks: ${transcriptLogs.length}`);
    console.log(`Recording webhooks: ${recordingLogs.length}\n`);
    
    if (transcriptLogs.length > 0) {
      console.log('=== RECENT TRANSCRIPT WEBHOOKS ===\n');
      transcriptLogs.slice(0, 10).forEach((log, i) => {
        console.log(`#${i + 1} - ${log.timestamp}`);
        console.log(`  Status: ${log.status}`);
        console.log(`  Message: ${log.message}`);
        if (log.error) console.log(`  Error: ${log.error}`);
        console.log('---\n');
      });
    } else {
      console.log('❌ No transcript webhooks received yet\n');
    }
    
    if (recordingLogs.length > 0) {
      console.log('=== RECENT RECORDING WEBHOOKS ===\n');
      recordingLogs.slice(0, 5).forEach((log, i) => {
        console.log(`#${i + 1} - ${log.timestamp}`);
        console.log(`  Status: ${log.status}`);
        console.log(`  Message: ${log.message}`);
        console.log('---\n');
      });
    }
    
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      console.log('❌ Webhook logs table does not exist yet');
    } else {
      console.error('Error:', error.message);
    }
  }
}

checkWebhookLogs();
