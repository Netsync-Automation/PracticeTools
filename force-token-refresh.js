import { refreshAccessToken } from './lib/webex-token-manager.js';

async function forceTokenRefresh() {
    try {
        console.log('🔄 Forcing token refresh to get updated scopes...\n');
        
        const newToken = await refreshAccessToken();
        console.log(`✅ New token obtained, length: ${newToken?.length || 0}`);
        
        // Test admin access with new token
        console.log('\n🧪 Testing admin access with refreshed token...');
        const adminResponse = await fetch('https://webexapis.com/v1/admin/meetingTranscripts?max=1', {
            headers: { 'Authorization': `Bearer ${newToken}` }
        });
        
        console.log(`📊 Admin API Status: ${adminResponse.status}`);
        
        if (adminResponse.ok) {
            const data = await adminResponse.json();
            console.log(`✅ Admin access now works! Found ${data.items?.length || 0} transcripts`);
        } else {
            const errorText = await adminResponse.text();
            console.log(`❌ Admin access still failed: ${errorText}`);
            console.log('\n💡 You may need to re-authorize the integration in the admin panel');
        }
        
    } catch (error) {
        console.error('Error:', error);
        console.log('\n💡 If refresh fails, you need to re-authorize in Admin → Settings → Company EDU');
    }
}

forceTokenRefresh();