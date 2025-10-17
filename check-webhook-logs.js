import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

async function checkWebhookLogs() {
    try {
        const result = await docClient.send(new ScanCommand({
            TableName: 'PracticeTools-dev-webex_logs',
            ScanIndexForward: false
        }));

        console.log('Recent webhook events:');
        console.log('='.repeat(50));
        
        const logs = (result.Items || [])
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 20);

        logs.forEach((log, index) => {
            console.log(`\n${index + 1}. [${log.timestamp}] ${log.event} - ${log.status}`);
            
            if (log.details && typeof log.details === 'object') {
                if (log.details.recordingId) console.log(`   Recording ID: ${log.details.recordingId}`);
                if (log.details.meetingId) console.log(`   Meeting ID: ${log.details.meetingId}`);
                if (log.details.endedInstanceId) console.log(`   Ended Instance ID: ${log.details.endedInstanceId}`);
                if (log.details.hostEmail) console.log(`   Host: ${log.details.hostEmail}`);
                if (log.details.transcriptCount !== undefined) console.log(`   Transcripts Found: ${log.details.transcriptCount}`);
                if (log.details.error) console.log(`   Error: ${log.details.error}`);
                if (log.details.status) console.log(`   HTTP Status: ${log.details.status}`);
                if (log.details.reason) console.log(`   Reason: ${log.details.reason}`);
            }
        });

    } catch (error) {
        console.error('Error:', error);
    }
}

checkWebhookLogs();