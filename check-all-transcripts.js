import { getSecureParameter } from './lib/ssm-config.js';

process.env.ENVIRONMENT = 'dev';

async function checkAllTranscripts() {
  const accessToken = await getSecureParameter('/PracticeTools/dev/NETSYNC_WEBEX_MEETINGS_ACCESS_TOKEN');
  
  console.log('=== CHECKING ALL AVAILABLE TRANSCRIPTS ===');
  
  // List all meeting transcripts (without meetingId filter)
  const transcriptsResponse = await fetch('https://webexapis.com/v1/meetingTranscripts', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  console.log('Response status:', transcriptsResponse.status);
  
  if (!transcriptsResponse.ok) {
    const errorText = await transcriptsResponse.text();
    console.log('Error response:', errorText);
    return;
  }
  
  const transcriptsData = await transcriptsResponse.json();
  console.log('Total transcripts found:', transcriptsData.items?.length || 0);
  
  if (!transcriptsData.items || transcriptsData.items.length === 0) {
    console.log('\n❌ No transcripts found in the organization');
    console.log('This suggests either:');
    console.log('1. Transcription is not enabled for meetings');
    console.log('2. No meetings have been transcribed yet');
    console.log('3. Access token lacks transcript permissions');
    return;
  }
  
  console.log('\n✅ Found transcripts:');
  transcriptsData.items.forEach((transcript, index) => {
    console.log(`\n${index + 1}. Transcript ID: ${transcript.id}`);
    console.log(`   Meeting ID: ${transcript.meetingId}`);
    console.log(`   Meeting Instance ID: ${transcript.meetingInstanceId}`);
    console.log(`   Created: ${transcript.created}`);
    console.log(`   Has Download URL: ${!!transcript.downloadUrl}`);
  });
}

checkAllTranscripts().catch(console.error);