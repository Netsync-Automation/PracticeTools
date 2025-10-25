// Test recording API with hostEmail parameter
import { getWebexTokens } from './lib/ssm.js';

async function testRecordingWithHost() {
  try {
    const recordingId = '3fe4fe3d87024345adb4556e6542afa7';
    const siteUrl = 'netsync.webex.com';
    
    // From webhook logs, we need to determine the host email
    // Let's try with known recording hosts from the configuration
    const possibleHostEmails = [
      'mbgriffin@netsync.com',
      'jengle@netsync.com'
    ];
    
    console.log('🔍 Testing recording API with hostEmail parameter...');
    
    const tokens = await getWebexTokens(siteUrl);
    if (!tokens) {
      throw new Error('No tokens found');
    }
    
    console.log('✅ Tokens retrieved');
    
    // Test with each possible host email
    for (const hostEmail of possibleHostEmails) {
      console.log(`\n🧪 Testing with hostEmail: ${hostEmail}`);
      
      const url = `https://webexapis.com/v1/recordings/${recordingId}?hostEmail=${encodeURIComponent(hostEmail)}`;
      console.log('📡 Request URL:', url);
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${tokens.accessToken}` }
      });
      
      console.log('📡 Response status:', response.status);
      
      if (response.ok) {
        const recording = await response.json();
        console.log('✅ SUCCESS! Recording details retrieved');
        console.log('📹 Recording topic:', recording.topic);
        console.log('👤 Host email:', recording.hostEmail);
        console.log('🔗 Download URL fields:');
        console.log('  - downloadUrl:', recording.downloadUrl);
        console.log('  - mp4Url:', recording.mp4Url);
        console.log('  - temporaryDirectDownloadLinks:', recording.temporaryDirectDownloadLinks);
        
        // Show all available fields
        console.log('📋 All fields:', Object.keys(recording));
        break;
      } else {
        const error = await response.text();
        console.log('❌ Failed:', error);
      }
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testRecordingWithHost();