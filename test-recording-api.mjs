// Test script to fetch recording details using Webex API
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssmClient = new SSMClient({ region: 'us-east-1' });

async function getAccessTokenForSite(siteUrl) {
  // The webhook came from netsync.webex.com, so use the NETSYNC tokens from dev environment
  const command = new GetParameterCommand({
    Name: '/PracticeTools/dev/NETSYNC_WEBEX_MEETINGS_ACCESS_TOKEN',
    WithDecryption: true
  });
  const result = await ssmClient.send(command);
  return result.Parameter.Value;
}

async function testRecordingAPI() {
  try {
    // Recording ID from the webhook logs
    const recordingId = '3fe4fe3d87024345adb4556e6542afa7';
    const siteUrl = 'netsync.webex.com'; // From webhook logs
    
    console.log('🔍 Testing recording API with ID:', recordingId);
    console.log('🌐 Site URL from webhook:', siteUrl);
    
    const accessToken = await getAccessTokenForSite(siteUrl);
    console.log('✅ Access token retrieved for site:', siteUrl);
    console.log('🔑 Token preview:', accessToken.substring(0, 20) + '...');
    
    // Fetch recording details
    const response = await fetch(`https://webexapis.com/v1/recordings/${recordingId}`, {
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📡 API Response Status:', response.status);
    console.log('📡 API Response Headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      return;
    }
    
    const recordingDetails = await response.json();
    console.log('📹 Recording Details:');
    console.log(JSON.stringify(recordingDetails, null, 2));
    
    // Check for download URL fields
    console.log('\n🔗 Download URL Analysis:');
    console.log('downloadUrl:', recordingDetails.downloadUrl);
    console.log('mp4Url:', recordingDetails.mp4Url);
    console.log('temporaryDirectDownloadLinks:', recordingDetails.temporaryDirectDownloadLinks);
    
    // List all available fields
    console.log('\n📋 All available fields:');
    console.log(Object.keys(recordingDetails));
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
    console.error(error.stack);
  }
}

testRecordingAPI();