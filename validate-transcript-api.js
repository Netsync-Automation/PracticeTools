import { getValidAccessToken } from './lib/webex-token-manager.js';

async function validateTranscriptAPI() {
  try {
    const meetingId = '22baa61bb3cc5e9eb62a0377e705d613_I_681567805035780754';
    const accessToken = await getValidAccessToken();
    
    console.log('=== TRANSCRIPT API VALIDATION ===');
    console.log('Meeting ID:', meetingId);
    
    // Test 1: List transcripts for meeting
    console.log('\n1. Testing meetingTranscripts API...');
    const listResponse = await fetch(`https://webexapis.com/v1/meetingTranscripts?meetingId=${meetingId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    console.log('Status:', listResponse.status);
    console.log('Headers:', Object.fromEntries(listResponse.headers.entries()));
    
    if (listResponse.ok) {
      const data = await listResponse.json();
      console.log('Response:', JSON.stringify(data, null, 2));
      
      if (data.items?.length > 0) {
        console.log('\n2. Testing transcript download...');
        const transcriptId = data.items[0].id;
        
        const downloadResponse = await fetch(`https://webexapis.com/v1/meetingTranscripts/${transcriptId}/download`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        console.log('Download Status:', downloadResponse.status);
        if (downloadResponse.ok) {
          const content = await downloadResponse.text();
          console.log('✅ Transcript content length:', content.length);
        } else {
          console.log('❌ Download failed:', await downloadResponse.text());
        }
      }
    } else {
      console.log('❌ List failed:', await listResponse.text());
    }
    
    // Test 2: Check if we have meeting:transcripts_read scope
    console.log('\n3. Testing token scopes...');
    const scopeResponse = await fetch('https://webexapis.com/v1/people/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (scopeResponse.ok) {
      console.log('✅ Token has valid scopes for API access');
    } else {
      console.log('❌ Token scope issue:', scopeResponse.status);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

validateTranscriptAPI();