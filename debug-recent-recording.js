import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssmClient = new SSMClient({ region: 'us-east-1' });

async function getAccessToken() {
    try {
        const response = await ssmClient.send(new GetParameterCommand({
            Name: '/PracticeTools/dev/WEBEX_MEETINGS_ACCESS_TOKEN',
            WithDecryption: true
        }));
        return response.Parameter?.Value;
    } catch (error) {
        console.error('Error getting access token:', error.message);
        return null;
    }
}

async function debugRecentRecording() {
    const accessToken = await getAccessToken();
    if (!accessToken) {
        console.error('No access token available');
        return;
    }

    try {
        // Get the most recent recording
        const recordingId = 'fd5584b6a0a7455c91c8b086d56a8c98'; // From logs - newest recording
        
        console.log('Fetching recording details...');
        const recordingResponse = await fetch(`https://webexapis.com/v1/recordings/${recordingId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!recordingResponse.ok) {
            console.error('Failed to fetch recording:', recordingResponse.status, await recordingResponse.text());
            return;
        }

        const recording = await recordingResponse.json();
        console.log('\nFull Recording Response:');
        console.log(JSON.stringify(recording, null, 2));
        
        console.log('\nKey Fields:');
        console.log('ID:', recording.id);
        console.log('Meeting ID:', recording.meetingId);
        console.log('Meeting Instance ID:', recording.meetingInstanceId);
        console.log('Topic:', recording.topic);
        console.log('Host User ID:', recording.hostUserId);
        console.log('Created:', recording.created);
        console.log('Duration:', recording.durationSeconds);

        // Check which ID we should use for transcripts
        const endedInstanceId = recording.meetingInstanceId || recording.meetingId;
        console.log('\nTranscript Access Check:');
        console.log('Meeting Instance ID:', recording.meetingInstanceId);
        console.log('Meeting ID:', recording.meetingId);
        console.log('Using for transcripts:', endedInstanceId);
        console.log('Has _I_ format:', endedInstanceId && endedInstanceId.includes('_I_'));

        if (endedInstanceId && endedInstanceId.includes('_I_')) {
            console.log('\nTesting transcript access with ended instance ID...');
            const transcriptResponse = await fetch(`https://webexapis.com/v1/meetingTranscripts?meetingId=${endedInstanceId}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            console.log('Transcript API Status:', transcriptResponse.status);
            
            if (transcriptResponse.ok) {
                const transcriptData = await transcriptResponse.json();
                console.log('Transcripts found:', transcriptData.items?.length || 0);
                
                if (transcriptData.items?.length > 0) {
                    console.log('First transcript:', transcriptData.items[0]);
                }
            } else {
                const errorText = await transcriptResponse.text();
                console.log('Transcript error:', errorText);
            }
        } else {
            console.log('No valid ended instance ID for transcript access');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

debugRecentRecording();