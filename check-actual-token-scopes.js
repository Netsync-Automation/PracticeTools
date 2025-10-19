import { getValidAccessToken } from './lib/webex-token-manager.js';

async function checkActualTokenScopes() {
    try {
        console.log('🔍 Checking actual token scopes from SSM...\n');
        
        const accessToken = await getValidAccessToken();
        if (!accessToken) {
            console.log('❌ No access token available');
            return;
        }

        // Decode JWT token to see scopes (tokens are usually JWTs)
        try {
            const tokenParts = accessToken.split('.');
            if (tokenParts.length === 3) {
                const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
                console.log('🎫 Token payload scopes:', payload.scope || 'No scopes in token');
                console.log('🕐 Token expires:', new Date(payload.exp * 1000).toISOString());
            }
        } catch (decodeError) {
            console.log('⚠️  Could not decode token as JWT');
        }

        // Test admin transcript API with current token
        console.log('\n🧪 Testing admin transcript API access...');
        const adminResponse = await fetch('https://webexapis.com/v1/admin/meetingTranscripts?max=5', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        console.log(`📊 Admin API Status: ${adminResponse.status}`);
        
        if (adminResponse.ok) {
            const data = await adminResponse.json();
            console.log(`✅ Admin access works! Found ${data.items?.length || 0} transcripts`);
            
            if (data.items?.length > 0) {
                console.log('\n📝 Available transcripts:');
                data.items.forEach((transcript, i) => {
                    console.log(`   ${i + 1}. ID: ${transcript.id}`);
                    console.log(`      Meeting: ${transcript.meetingId}`);
                    console.log(`      Created: ${transcript.created}`);
                    console.log(`      Host: ${transcript.hostEmail || 'N/A'}`);
                });
            }
        } else {
            const errorText = await adminResponse.text();
            console.log(`❌ Admin access failed: ${errorText}`);
        }

        // Test regular transcript API
        console.log('\n🧪 Testing regular transcript API access...');
        const regularResponse = await fetch('https://webexapis.com/v1/meetingTranscripts?max=5', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        console.log(`📊 Regular API Status: ${regularResponse.status}`);
        
        if (regularResponse.ok) {
            const data = await regularResponse.json();
            console.log(`✅ Regular access works! Found ${data.items?.length || 0} transcripts`);
        } else {
            const errorText = await regularResponse.text();
            console.log(`❌ Regular access failed: ${errorText}`);
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

checkActualTokenScopes();