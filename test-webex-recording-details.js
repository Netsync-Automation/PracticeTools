import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssmClient = new SSMClient({ region: 'us-east-1' });

async function getAccessToken() {
    try {
        const response = await ssmClient.send(new GetParameterCommand({
            Name: '/PracticeTools/dev/webex-meetings-access-token',
            WithDecryption: true
        }));
        return response.Parameter?.Value;
    } catch (error) {
        console.error('Error getting access token:', error);
        return null;
    }
}

async function testRecordingDetails() {
    const accessToken = await getAccessToken();
    if (!accessToken) {
        console.error('No access token available');
        return;
    }

    try {
        // Get list of recordings to see what data structure we get
        const response = await fetch('https://webexapis.com/v1/recordings?max=5', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            console.error('Failed to fetch recordings:', response.status, await response.text());
            return;
        }

        const data = await response.json();
        console.log('Recordings found:', data.items?.length || 0);
        
        data.items?.forEach((recording, index) => {
            console.log(`\n--- Recording ${index + 1} ---`);
            console.log('ID:', recording.id);
            console.log('Meeting ID:', recording.meetingId);
            console.log('Meeting Instance ID:', recording.meetingInstanceId);
            console.log('Topic:', recording.topic);
            console.log('Host User ID:', recording.hostUserId);
            console.log('Created:', recording.created);
            console.log('Duration:', recording.durationSeconds);
            
            // Check for ended instance ID format
            if (recording.meetingInstanceId && recording.meetingInstanceId.includes('_I_')) {
                console.log('✓ Has ended instance ID format for transcripts');
            } else {
                console.log('✗ No ended instance ID format found');
            }
        });

    } catch (error) {
        console.error('Error:', error);
    }
}

testRecordingDetails();