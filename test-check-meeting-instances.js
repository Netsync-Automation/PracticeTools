import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

async function checkMeetingInstances() {
    try {
        const result = await docClient.send(new ScanCommand({
            TableName: 'PracticeTools-dev-WebexRecordings'
        }));

        console.log('Found recordings:', result.Items?.length || 0);
        
        result.Items?.forEach(item => {
            console.log('\n--- Recording ---');
            console.log('ID:', item.id);
            console.log('Meeting ID:', item.meetingId);
            console.log('Meeting Instance ID:', item.meetingInstanceId);
            console.log('Host Email:', item.hostEmail);
            console.log('Topic:', item.topic);
            console.log('Created:', item.created);
            
            // Check if we have an instance ID that looks like ended meeting format
            if (item.meetingInstanceId && item.meetingInstanceId.includes('_I_')) {
                console.log('✓ Has ended instance ID format');
            } else {
                console.log('✗ Missing ended instance ID format');
            }
        });

    } catch (error) {
        console.error('Error:', error);
    }
}

checkMeetingInstances();