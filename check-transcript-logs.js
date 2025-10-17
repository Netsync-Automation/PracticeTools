import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

async function checkTranscriptLogs() {
    try {
        const result = await docClient.send(new ScanCommand({
            TableName: 'PracticeTools-dev-webex_logs'
        }));

        console.log('Transcript-related webhook events:');
        console.log('='.repeat(50));
        
        const transcriptLogs = (result.Items || [])
            .filter(log => log.event && (
                log.event.includes('transcript') || 
                log.event.includes('no_ended_instance_id') ||
                (log.details && JSON.stringify(log.details).includes('transcript'))
            ))
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        if (transcriptLogs.length === 0) {
            console.log('No transcript-related logs found.');
            
            // Check the most recent recording processing
            const recentLogs = (result.Items || [])
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, 10);
                
            console.log('\nMost recent recording details:');
            const recentRecording = recentLogs.find(log => log.event === 'recording_fetched');
            if (recentRecording && recentRecording.details) {
                console.log(`Meeting ID: ${recentRecording.details.meetingId}`);
                console.log(`Recording ID: ${recentRecording.details.recordingId}`);
                console.log(`Host: ${recentRecording.details.hostEmail}`);
                
                // Check if this meeting ID has ended instance format
                if (recentRecording.details.meetingId && recentRecording.details.meetingId.includes('_I_')) {
                    console.log('✓ Meeting ID has ended instance format');
                } else {
                    console.log('✗ Meeting ID does NOT have ended instance format');
                }
            }
            
            return;
        }

        transcriptLogs.forEach((log, index) => {
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

checkTranscriptLogs();