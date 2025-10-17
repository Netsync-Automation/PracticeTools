import { getValidAccessToken } from './lib/webex-token-manager.js';

async function testTranscriptFetch() {
  try {
    const meetingId = '22baa61bb3cc5e9eb62a0377e705d613_I_681567805035780754';
    const accessToken = await getValidAccessToken();
    
    console.log('Testing transcript fetch for meetingId:', meetingId);
    
    // Step 1: Get transcript list
    console.log('Step 1: Fetching transcript list...');
    const transcriptResponse = await fetch(`https://webexapis.com/v1/meetingTranscripts?meetingId=${meetingId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    console.log('Transcript list response status:', transcriptResponse.status);
    
    if (transcriptResponse.ok) {
      const transcriptData = await transcriptResponse.json();
      console.log('Transcript data:', JSON.stringify(transcriptData, null, 2));
      
      if (transcriptData.items?.length > 0) {
        console.log('Step 2: Downloading transcript content...');
        const transcriptId = transcriptData.items[0].id;
        console.log('Transcript ID:', transcriptId);
        
        const transcriptDetailResponse = await fetch(`https://webexapis.com/v1/meetingTranscripts/${transcriptId}/download`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        console.log('Transcript download response status:', transcriptDetailResponse.status);
        
        if (transcriptDetailResponse.ok) {
          const transcript = await transcriptDetailResponse.text();
          console.log('✅ Transcript downloaded successfully');
          console.log('Transcript length:', transcript.length);
          console.log('First 200 chars:', transcript.substring(0, 200));
        } else {
          console.log('❌ Transcript download failed');
          const errorText = await transcriptDetailResponse.text();
          console.log('Error response:', errorText);
        }
      } else {
        console.log('❌ No transcripts found for this meeting');
      }
    } else {
      console.log('❌ Transcript list fetch failed');
      const errorText = await transcriptResponse.text();
      console.log('Error response:', errorText);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testTranscriptFetch();