// Troubleshoot recording API access permissions
import { getWebexTokens, getSitePrefix } from './lib/ssm.js';

async function troubleshootRecordingAPI() {
  try {
    const recordingId = '3fe4fe3d87024345adb4556e6542afa7';
    const siteUrl = 'netsync.webex.com';
    
    console.log('🔍 Troubleshooting recording API access...');
    console.log('📹 Recording ID:', recordingId);
    console.log('🌐 Site URL:', siteUrl);
    
    // Get tokens using environment-aware SSM
    const tokens = await getWebexTokens(siteUrl);
    if (!tokens) {
      throw new Error('No tokens found for site');
    }
    
    console.log('✅ Tokens retrieved from environment-aware SSM');
    console.log('🔑 Access token preview:', tokens.accessToken.substring(0, 20) + '...');
    
    // Test 1: Check who we are authenticated as
    console.log('\n🧪 Test 1: Check authenticated user identity');
    const meResponse = await fetch('https://webexapis.com/v1/people/me', {
      headers: { 'Authorization': `Bearer ${tokens.accessToken}` }
    });
    
    if (meResponse.ok) {
      const me = await meResponse.json();
      console.log('👤 Authenticated as:', me.displayName, '(' + me.emails[0] + ')');
      console.log('🏢 Organization ID:', me.orgId);
    } else {
      console.log('❌ Failed to get user identity:', meResponse.status);
    }
    
    // Test 2: List all recordings to see what we can access
    console.log('\n🧪 Test 2: List accessible recordings');
    const listResponse = await fetch('https://webexapis.com/v1/recordings?max=10', {
      headers: { 'Authorization': `Bearer ${tokens.accessToken}` }
    });
    
    if (listResponse.ok) {
      const recordings = await listResponse.json();
      console.log('📋 Found', recordings.items?.length || 0, 'accessible recordings');
      
      if (recordings.items?.length > 0) {
        console.log('📹 Sample recordings:');
        recordings.items.slice(0, 3).forEach(rec => {
          console.log(`  - ${rec.id}: ${rec.topic} (Host: ${rec.hostEmail})`);
        });
        
        // Check if our target recording is in the list
        const targetRecording = recordings.items.find(r => r.id === recordingId);
        if (targetRecording) {
          console.log('✅ Target recording found in accessible list!');
          console.log('📹 Recording details:', JSON.stringify(targetRecording, null, 2));
        } else {
          console.log('❌ Target recording NOT found in accessible list');
        }
      }
    } else {
      console.log('❌ Failed to list recordings:', listResponse.status);
    }
    
    // Test 3: Try to access the specific recording
    console.log('\n🧪 Test 3: Direct recording access');
    const recordingResponse = await fetch(`https://webexapis.com/v1/recordings/${recordingId}`, {
      headers: { 'Authorization': `Bearer ${tokens.accessToken}` }
    });
    
    console.log('📡 Direct access status:', recordingResponse.status);
    
    if (recordingResponse.ok) {
      const recording = await recordingResponse.json();
      console.log('✅ Recording accessible via direct API');
      console.log('📹 Recording details:', JSON.stringify(recording, null, 2));
    } else {
      const error = await recordingResponse.text();
      console.log('❌ Direct access failed:', error);
    }
    
    // Test 4: Check admin/compliance officer permissions
    console.log('\n🧪 Test 4: Check if we need admin/compliance officer scope');
    console.log('💡 The token might need "spark-compliance:recordings_read" scope for org-wide access');
    console.log('💡 Or "spark-admin:recordings_read" scope for admin access');
    console.log('💡 Current token might only have user-level recording access');
    
  } catch (error) {
    console.error('💥 Troubleshooting failed:', error.message);
    console.error(error.stack);
  }
}

troubleshootRecordingAPI();