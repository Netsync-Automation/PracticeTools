import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const region = 'us-east-1';
const dynamodb = new DynamoDBClient({ region });

async function checkMeetingDatabase() {
    console.log('\n=== CHECKING MEETING DATABASE ===');
    
    try {
        // Check recent meetings
        const scanCommand = new ScanCommand({
            TableName: 'PracticeTools-dev-Meetings',
            Limit: 10
        });
        
        const response = await dynamodb.send(scanCommand);
        
        if (response.Items && response.Items.length > 0) {
            console.log(`Found ${response.Items.length} meetings in database:`);
            response.Items.forEach(item => {
                const meeting = unmarshall(item);
                console.log(`- Meeting ID: ${meeting.meetingId}`);
                console.log(`  Host: ${meeting.hostEmail || 'N/A'}`);
                console.log(`  Topic: ${meeting.topic || 'N/A'}`);
                console.log(`  Created: ${meeting.createdAt || 'N/A'}`);
                console.log(`  Recording ID: ${meeting.recordingId || 'N/A'}`);
                console.log('---');
            });
        } else {
            console.log('No meetings found in database');
        }
    } catch (error) {
        console.error('Error checking meeting database:', error.message);
    }
}

async function checkRecordingDatabase() {
    console.log('\n=== CHECKING RECORDING DATABASE ===');
    
    try {
        const scanCommand = new ScanCommand({
            TableName: 'PracticeTools-dev-Recordings',
            Limit: 10
        });
        
        const response = await dynamodb.send(scanCommand);
        
        if (response.Items && response.Items.length > 0) {
            console.log(`Found ${response.Items.length} recordings in database:`);
            response.Items.forEach(item => {
                const recording = unmarshall(item);
                console.log(`- Recording ID: ${recording.recordingId}`);
                console.log(`  Meeting ID: ${recording.meetingId || 'N/A'}`);
                console.log(`  Host: ${recording.hostEmail || 'N/A'}`);
                console.log(`  Created: ${recording.createdAt || 'N/A'}`);
                console.log(`  Status: ${recording.status || 'N/A'}`);
                console.log('---');
            });
        } else {
            console.log('No recordings found in database');
        }
    } catch (error) {
        console.error('Error checking recording database:', error.message);
    }
}

async function main() {
    console.log('Note: For webhook logs, check App Runner logs in AWS Console');
    console.log('Log Group: /aws/apprunner/PracticeTools-dev-service/application\n');
    
    await checkMeetingDatabase();
    await checkRecordingDatabase();
}

main().catch(console.error);