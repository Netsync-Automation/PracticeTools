import { getValidAccessToken } from './lib/webex-token-manager.js';

async function checkTranscriptAccess() {
    try {
        const accessToken = await getValidAccessToken();
        if (!accessToken) {
            console.log('❌ No access token available');
            return;
        }

        // Test different transcript API endpoints to see what we can access
        console.log('🔍 Testing transcript API access...\n');

        // 1. Try to list all meeting transcripts (admin scope)
        console.log('1. Testing admin transcript access...');
        try {
            const adminResponse = await fetch('https://webexapis.com/v1/admin/meetingTranscripts', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            console.log(`   Admin API status: ${adminResponse.status}`);
            if (adminResponse.ok) {
                const data = await adminResponse.json();
                console.log(`   ✅ Admin access works - found ${data.items?.length || 0} transcripts`);
            } else {
                const error = await adminResponse.text();
                console.log(`   ❌ Admin access failed: ${error}`);
            }
        } catch (error) {
            console.log(`   ❌ Admin access error: ${error.message}`);
        }

        // 2. Try regular transcript API
        console.log('\n2. Testing regular transcript access...');
        try {
            const regularResponse = await fetch('https://webexapis.com/v1/meetingTranscripts', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            console.log(`   Regular API status: ${regularResponse.status}`);
            if (regularResponse.ok) {
                const data = await regularResponse.json();
                console.log(`   ✅ Regular access works - found ${data.items?.length || 0} transcripts`);
                
                // Show some transcript details
                if (data.items?.length > 0) {
                    console.log('\n   📝 Recent transcripts:');
                    data.items.slice(0, 3).forEach((transcript, i) => {
                        console.log(`      ${i + 1}. ID: ${transcript.id}`);
                        console.log(`         Meeting: ${transcript.meetingId}`);
                        console.log(`         Created: ${transcript.created}`);
                        console.log(`         Status: ${transcript.status || 'available'}`);
                    });
                }
            } else {
                const error = await regularResponse.text();
                console.log(`   ❌ Regular access failed: ${error}`);
            }
        } catch (error) {
            console.log(`   ❌ Regular access error: ${error.message}`);
        }

        // 3. Check token scopes
        console.log('\n3. Checking token scopes...');
        try {
            const scopeResponse = await fetch('https://webexapis.com/v1/people/me', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (scopeResponse.ok) {
                console.log('   ✅ Token is valid for people API');
            }
        } catch (error) {
            console.log(`   ❌ Token scope error: ${error.message}`);
        }

        console.log('\n💡 Required scopes for transcript webhooks:');
        console.log('   - meeting:transcripts_read');
        console.log('   - meeting:admin_transcripts_read (for admin access)');
        console.log('   - spark:recordings_read');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

checkTranscriptAccess();