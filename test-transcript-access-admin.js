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
        console.error('Error getting access token:', error.message);
        return null;
    }
}

async function testAdminTranscriptAccess() {
    const accessToken = await getAccessToken();
    if (!accessToken) {
        console.error('No access token available. Please complete OAuth authorization first.');
        return;
    }

    console.log('Testing admin transcript access...\n');

    try {
        // Test 1: Get recent recordings to find ended instance IDs
        console.log('1. Fetching recent recordings to find ended instance IDs...');
        const recordingsResponse = await fetch('https://webexapis.com/v1/recordings?max=10', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!recordingsResponse.ok) {
            console.error('Failed to fetch recordings:', recordingsResponse.status);
            return;
        }

        const recordings = await recordingsResponse.json();
        console.log(`Found ${recordings.items?.length || 0} recordings\n`);

        // Find recordings with ended instance IDs
        const endedInstances = recordings.items?.filter(r => 
            r.meetingInstanceId && r.meetingInstanceId.includes('_I_')
        ) || [];

        console.log(`Found ${endedInstances.length} recordings with ended instance IDs:\n`);
        
        endedInstances.forEach((recording, index) => {
            console.log(`${index + 1}. ${recording.topic}`);
            console.log(`   Instance ID: ${recording.meetingInstanceId}`);
            console.log(`   Created: ${recording.created}`);
            console.log(`   Duration: ${recording.durationSeconds}s\n`);
        });

        // Test 2: Try to get transcripts for each ended instance
        if (endedInstances.length > 0) {
            console.log('2. Testing transcript access for ended instances...\n');
            
            for (const recording of endedInstances.slice(0, 3)) { // Test first 3
                console.log(`Testing: ${recording.topic}`);
                console.log(`Instance ID: ${recording.meetingInstanceId}`);
                
                const transcriptResponse = await fetch(
                    `https://webexapis.com/v1/meetingTranscripts?meetingId=${recording.meetingInstanceId}`,
                    { headers: { 'Authorization': `Bearer ${accessToken}` } }
                );
                
                console.log(`Status: ${transcriptResponse.status}`);
                
                if (transcriptResponse.ok) {
                    const transcriptData = await transcriptResponse.json();
                    console.log(`Transcripts found: ${transcriptData.items?.length || 0}`);
                    
                    if (transcriptData.items?.length > 0) {
                        const transcript = transcriptData.items[0];
                        console.log(`Transcript ID: ${transcript.id}`);
                        console.log(`VTT Link: ${transcript.vttDownloadLink ? 'Available' : 'None'}`);
                        console.log(`TXT Link: ${transcript.txtDownloadLink ? 'Available' : 'None'}`);
                    }
                } else {
                    const errorText = await transcriptResponse.text();
                    console.log(`Error: ${errorText}`);
                }
                console.log('---\n');
            }
        }

        // Test 3: Try admin endpoint if regular endpoint fails
        console.log('3. Testing admin transcript endpoint...\n');
        const adminResponse = await fetch('https://webexapis.com/v1/admin/meetingTranscripts?max=5', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        console.log(`Admin endpoint status: ${adminResponse.status}`);
        if (adminResponse.ok) {
            const adminData = await adminResponse.json();
            console.log(`Admin transcripts found: ${adminData.items?.length || 0}`);
        } else {
            const errorText = await adminResponse.text();
            console.log(`Admin error: ${errorText}`);
        }

    } catch (error) {
        console.error('Test error:', error);
    }
}

testAdminTranscriptAccess();