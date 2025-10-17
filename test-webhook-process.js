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

async function testWebhookProcess() {
    const accessToken = await getAccessToken();
    if (!accessToken) {
        console.error('No access token available');
        return;
    }

    const recordingId = 'fd5584b6a0a7455c91c8b086d56a8c98';
    
    console.log('=== SIMULATING WEBHOOK PROCESS ===\n');
    
    try {
        // Step 1: Get recording details (what webhook does)
        console.log('1. Fetching recording details...');
        const recordingResponse = await fetch(`https://webexapis.com/v1/recordings/${recordingId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!recordingResponse.ok) {
            console.error('Failed to fetch recording:', recordingResponse.status);
            return;
        }

        const recording = await recordingResponse.json();
        console.log('✅ Recording fetched successfully');
        
        // Step 2: Test transcript logic (what webhook should do)
        console.log('\n2. Testing transcript detection logic...');
        
        const directTranscriptUrl = recording.temporaryDirectDownloadLinks?.transcriptDownloadLink;
        console.log('Direct transcript URL exists:', !!directTranscriptUrl);
        
        let transcript = '';
        
        // Method 1: Direct download
        if (directTranscriptUrl) {
            console.log('\n3a. Attempting direct transcript download...');
            try {
                const directResponse = await fetch(directTranscriptUrl);
                if (directResponse.ok) {
                    transcript = await directResponse.text();
                    console.log('✅ Direct transcript downloaded:', transcript.length, 'characters');
                } else {
                    console.log('❌ Direct transcript failed:', directResponse.status);
                }
            } catch (error) {
                console.log('❌ Direct transcript error:', error.message);
            }
        }
        
        // Method 2: API fallback
        if (!transcript && recording.meetingId && recording.meetingId.includes('_I_')) {
            console.log('\n3b. Attempting API transcript method...');
            try {
                const transcriptResponse = await fetch(`https://webexapis.com/v1/meetingTranscripts?meetingId=${recording.meetingId}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                
                if (transcriptResponse.ok) {
                    const transcriptData = await transcriptResponse.json();
                    console.log('API transcripts found:', transcriptData.items?.length || 0);
                    
                    if (transcriptData.items?.length > 0) {
                        const transcriptItem = transcriptData.items[0];
                        const downloadUrl = transcriptItem.vttDownloadLink || transcriptItem.txtDownloadLink;
                        
                        if (downloadUrl) {
                            const transcriptDetailResponse = await fetch(downloadUrl, {
                                headers: { 'Authorization': `Bearer ${accessToken}` }
                            });
                            
                            if (transcriptDetailResponse.ok) {
                                transcript = await transcriptDetailResponse.text();
                                console.log('✅ API transcript downloaded:', transcript.length, 'characters');
                            }
                        }
                    }
                } else {
                    console.log('❌ API transcript failed:', transcriptResponse.status);
                }
            } catch (error) {
                console.log('❌ API transcript error:', error.message);
            }
        }
        
        // Final result
        console.log('\n=== FINAL RESULT ===');
        if (transcript) {
            console.log('✅ SUCCESS: Transcript retrieved');
            console.log('Length:', transcript.length, 'characters');
            console.log('Method:', directTranscriptUrl ? 'Direct download' : 'API method');
            console.log('Preview:', transcript.substring(0, 200) + '...');
        } else {
            console.log('❌ FAILED: No transcript retrieved');
        }
        
    } catch (error) {
        console.error('Process error:', error);
    }
}

testWebhookProcess();