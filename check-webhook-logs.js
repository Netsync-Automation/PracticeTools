import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

function getEnvironment() {
    return process.env.ENVIRONMENT === 'prod' ? 'prod' : 'dev';
}

function getTableName(baseName) {
    const env = getEnvironment();
    return env === 'prod' ? `PracticeTools-${baseName}` : `PracticeTools-${env}-${baseName}`;
}

async function checkWebhookLogs() {
    try {
        console.log('Checking recent webhook logs...\n');
        
        const tableName = getTableName('webex_logs');
        const response = await docClient.send(new ScanCommand({
            TableName: tableName,
            FilterExpression: '#ts > :timestamp',
            ExpressionAttributeNames: {
                '#ts': 'timestamp'
            },
            ExpressionAttributeValues: {
                ':timestamp': new Date(Date.now() - 30 * 60 * 1000).toISOString() // Last 30 minutes
            }
        }));
        
        const logs = (response.Items || []).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        if (logs.length === 0) {
            console.log('No recent webhook logs found in the last 30 minutes.');
            return;
        }
        
        console.log(`Found ${logs.length} recent webhook events:\n`);
        
        logs.forEach((log, index) => {
            const time = new Date(log.timestamp).toLocaleTimeString();
            console.log(`${index + 1}. [${time}] ${log.event} - ${log.status}`);
            
            if (log.details) {
                if (log.event === 'host_lookup' && log.details.hostEmail) {
                    console.log(`   → Host: ${log.details.hostEmail} (ID: ${log.details.hostUserId})`);
                } else if (log.event === 'filtered' && log.details.reason) {
                    console.log(`   → Reason: ${log.details.reason}`);
                    if (log.details.hostEmail) {
                        console.log(`   → Host: ${log.details.hostEmail}`);
                    }
                } else if (log.event === 'processing_recording') {
                    console.log(`   → Recording: ${log.details.recordingId}`);
                    console.log(`   → Host: ${log.details.hostEmail}`);
                } else if (log.event === 'meeting_stored') {
                    console.log(`   → Meeting stored: ${log.details.meetingId}`);
                }
            }
            console.log('');
        });
        
        // Check if any recordings were processed
        const recordingEvents = logs.filter(log => 
            log.event === 'processing_recording' || 
            log.event === 'meeting_stored' ||
            log.event === 'recording_fetched'
        );
        
        if (recordingEvents.length > 0) {
            console.log('✅ Recording processing detected! Checking meeting storage...\n');
            await checkMeetingStorage();
        } else {
            console.log('ℹ️  No recording processing events found in recent logs.');
        }
        
    } catch (error) {
        console.error('Error checking webhook logs:', error);
    }
}

async function checkMeetingStorage() {
    try {
        const tableName = getTableName('meetings');
        const response = await docClient.send(new ScanCommand({
            TableName: tableName,
            FilterExpression: '#ts > :timestamp',
            ExpressionAttributeNames: {
                '#ts': 'createdAt'
            },
            ExpressionAttributeValues: {
                ':timestamp': new Date(Date.now() - 30 * 60 * 1000).toISOString()
            }
        }));
        
        const meetings = response.Items || [];
        
        if (meetings.length === 0) {
            console.log('No recent meetings found in storage.');
            return;
        }
        
        console.log(`Found ${meetings.length} recent meeting(s) in storage:\n`);
        
        meetings.forEach((meeting, index) => {
            console.log(`${index + 1}. Meeting ID: ${meeting.meetingId}`);
            console.log(`   Host: ${meeting.host}`);
            console.log(`   Start Time: ${meeting.startTime}`);
            console.log(`   Duration: ${meeting.duration || 'N/A'} seconds`);
            console.log(`   Has Recording: ${meeting.recordingData ? 'Yes' : 'No'}`);
            console.log(`   Has Transcript: ${meeting.transcript ? 'Yes' : 'No'}`);
            console.log(`   Created: ${new Date(meeting.createdAt).toLocaleString()}`);
            console.log('');
        });
        
    } catch (error) {
        console.error('Error checking meeting storage:', error);
    }
}

checkWebhookLogs();