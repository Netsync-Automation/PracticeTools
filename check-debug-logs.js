import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

async function checkDebugLogs() {
    try {
        const result = await docClient.send(new ScanCommand({
            TableName: 'PracticeTools-dev-webex_logs'
        }));

        console.log('Debug logs for transcript processing:');
        console.log('='.repeat(50));
        
        const debugLogs = (result.Items || [])
            .filter(log => log.event && (
                log.event.includes('debug') || 
                log.event.includes('recording_structure') ||
                log.event.includes('transcript_debug')
            ))
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 10);

        if (debugLogs.length === 0) {
            console.log('No debug logs found.');
            return;
        }

        debugLogs.forEach((log, index) => {
            console.log(`\n${index + 1}. [${log.timestamp}] ${log.event} - ${log.status}`);
            
            if (log.details && typeof log.details === 'object') {
                Object.keys(log.details).forEach(key => {
                    console.log(`   ${key}: ${JSON.stringify(log.details[key])}`);
                });
            }
        });

    } catch (error) {
        console.error('Error:', error);
    }
}

checkDebugLogs();