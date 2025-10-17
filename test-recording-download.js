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

async function testRecordingDownload() {
    const accessToken = await getAccessToken();
    if (!accessToken) {
        console.error('No access token available');
        return;
    }

    const recordingId = '369bc6304e8e445f9ee5f7014aa670f2'; // Latest recording from logs
    
    console.log('Testing recording download link...\n');
    
    try {
        // Get recording details
        const recordingResponse = await fetch(`https://webexapis.com/v1/recordings/${recordingId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!recordingResponse.ok) {
            console.error('Failed to fetch recording:', recordingResponse.status);
            return;
        }

        const recording = await recordingResponse.json();
        
        console.log('Recording info:');
        console.log('- ID:', recording.id);
        console.log('- Topic:', recording.topic);
        console.log('- Duration:', recording.durationSeconds, 'seconds');
        console.log('- Size:', recording.sizeBytes, 'bytes');
        console.log('- Format:', recording.format);
        
        console.log('\nTemporary download links:');
        const links = recording.temporaryDirectDownloadLinks;
        if (links) {
            Object.keys(links).forEach(key => {
                if (key !== 'expiration') {
                    console.log(`- ${key}: Available`);
                }
            });
            console.log('- Expires:', links.expiration);
        }
        
        // Test the recording download link
        const recordingDownloadLink = links?.recordingDownloadLink;
        if (recordingDownloadLink) {
            console.log('\nTesting recording download...');
            
            const downloadResponse = await fetch(recordingDownloadLink, {
                method: 'HEAD' // Just get headers, don't download the full file
            });
            
            console.log('Download response:');
            console.log('- Status:', downloadResponse.status);
            console.log('- Content-Type:', downloadResponse.headers.get('content-type'));
            console.log('- Content-Length:', downloadResponse.headers.get('content-length'));
            console.log('- Content-Disposition:', downloadResponse.headers.get('content-disposition'));
            
            if (downloadResponse.ok) {
                const contentType = downloadResponse.headers.get('content-type');
                const contentLength = downloadResponse.headers.get('content-length');
                
                console.log('\n✅ Recording download link works!');
                console.log('- File type:', contentType);
                console.log('- File size:', Math.round(parseInt(contentLength) / 1024 / 1024 * 100) / 100, 'MB');
                
                // Check if it's actually a video file
                if (contentType && (contentType.includes('video') || contentType.includes('mp4'))) {
                    console.log('- ✅ Confirmed: This is a video file');
                } else {
                    console.log('- ⚠️  Warning: Content type suggests this might not be a video file');
                }
            } else {
                console.log('❌ Recording download failed');
            }
        } else {
            console.log('❌ No recording download link available');
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testRecordingDownload();