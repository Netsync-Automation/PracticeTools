import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

async function checkTranscriptLogs() {
    try {
        const result = await docClient.send(new ScanCommand({
            TableName: 'PracticeTools-dev-webex_logs',
            FilterExpression: 'contains(#event, :transcript) OR contains(#event, :meetingTranscripts)',
            ExpressionAttributeNames: {
                '#event': 'event'
            },
            ExpressionAttributeValues: {
                ':transcript': 'transcript',
                ':meetingTranscripts': 'meetingTranscripts'
            }
        }));

        console.log('Transcript-related webhook events:');
        console.log('='.repeat(50));
        
        const logs = (result.Items || [])
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        if (logs.length === 0) {
            console.log('❌ NO TRANSCRIPT WEBHOOK EVENTS FOUND');
            console.log('');
            console.log('This confirms that transcript webhooks are not being received.');
            console.log('Possible causes:');
            console.log('1. Webex is not generating transcript webhooks for recent meetings');
            console.log('2. Transcripts are not being created for the meetings');
            console.log('3. There may be a delay in transcript processing');
            console.log('4. The webhook URL might not be reachable from Webex');
            return;
        }

        logs.forEach((log, index) => {
            console.log(`\n${index + 1}. [${log.timestamp}] ${log.event} - ${log.status}`);
            
            if (log.details && typeof log.details === 'object') {
                if (log.details.transcriptId) console.log(`   Transcript ID: ${log.details.transcriptId}`);
                if (log.details.meetingId) console.log(`   Meeting ID: ${log.details.meetingId}`);
                if (log.details.endedInstanceId) console.log(`   Ended Instance ID: ${log.details.endedInstanceId}`);
                if (log.details.error) console.log(`   Error: ${log.details.error}`);
                if (log.details.transcriptLength !== undefined) console.log(`   Transcript Length: ${log.details.transcriptLength}`);
            }
        });

    } catch (error) {
        console.error('Error:', error);
    }
}

checkTranscriptLogs();