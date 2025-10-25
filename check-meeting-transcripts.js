import { getSecureParameter } from './lib/ssm-config.js';

process.env.ENVIRONMENT = 'dev';

async function checkMeetingTranscripts() {
  const meetingId = '22baa61bb3cc5e9eb62a0377e705d613_I_683065828790247024';
  const accessToken = await getSecureParameter('/PracticeTools/dev/NETSYNC_WEBEX_MEETINGS_ACCESS_TOKEN');
  
  console.log('=== CHECKING TRANSCRIPTS FOR MEETING ===');
  console.log('Meeting ID:', meetingId);
  
  // List meeting transcripts
  console.log('\n=== LIST MEETING TRANSCRIPTS API ===');
  const transcriptsResponse = await fetch(`https://webexapis.com/v1/meetingTranscripts?meetingId=${meetingId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  console.log('Response status:', transcriptsResponse.status);
  console.log('Response headers:', Object.fromEntries(transcriptsResponse.headers.entries()));
  
  if (!transcriptsResponse.ok) {
    const errorText = await transcriptsResponse.text();
    console.log('Error response:', errorText);
    return;
  }
  
  const transcriptsData = await transcriptsResponse.json();
  console.log('Transcripts response:', JSON.stringify(transcriptsData, null, 2));
  
  if (!transcriptsData.items || transcriptsData.items.length === 0) {
    console.log('\n❌ No transcripts found for this meeting');
    return;
  }
  
  console.log(`\n✅ Found ${transcriptsData.items.length} transcript(s)`);
  
  // Try to download each transcript
  for (const transcript of transcriptsData.items) {
    console.log(`\n=== DOWNLOADING TRANSCRIPT ${transcript.id} ===`);
    console.log('Transcript details:', {
      id: transcript.id,
      meetingId: transcript.meetingId,
      meetingInstanceId: transcript.meetingInstanceId,
      created: transcript.created,
      downloadUrl: transcript.downloadUrl
    });
    
    // Download transcript using the downloadUrl
    if (transcript.downloadUrl) {
      console.log('Attempting download from:', transcript.downloadUrl);
      
      const downloadResponse = await fetch(transcript.downloadUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      console.log('Download response status:', downloadResponse.status);
      console.log('Download response headers:', Object.fromEntries(downloadResponse.headers.entries()));
      
      if (downloadResponse.ok) {
        const transcriptContent = await downloadResponse.text();
        console.log('✅ Transcript downloaded successfully');
        console.log('Content length:', transcriptContent.length);
        console.log('First 200 characters:', transcriptContent.substring(0, 200));
      } else {
        const errorText = await downloadResponse.text();
        console.log('❌ Download failed:', errorText);
      }
    } else {
      console.log('❌ No downloadUrl provided in transcript data');
    }
  }
}

checkMeetingTranscripts().catch(console.error);