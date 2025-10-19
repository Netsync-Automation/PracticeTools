import { getValidAccessToken } from './lib/webex-token-manager.js';

async function checkIntegrationScopes() {
    try {
        console.log('🔍 Checking Webex Integration Configuration...\n');
        
        const accessToken = await getValidAccessToken();
        if (!accessToken) {
            console.log('❌ No access token available');
            return;
        }

        // Check what we can access with current token
        console.log('📊 Current API Access Test:');
        
        const tests = [
            { name: 'People API', url: 'https://webexapis.com/v1/people/me' },
            { name: 'Recordings API', url: 'https://webexapis.com/v1/recordings?max=1' },
            { name: 'Meeting Transcripts API', url: 'https://webexapis.com/v1/meetingTranscripts?max=1' },
            { name: 'Admin Meeting Transcripts API', url: 'https://webexapis.com/v1/admin/meetingTranscripts?max=1' },
            { name: 'Webhooks API', url: 'https://webexapis.com/v1/webhooks' }
        ];

        for (const test of tests) {
            try {
                const response = await fetch(test.url, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    console.log(`   ✅ ${test.name}: ${response.status} - ${data.items?.length || 'OK'} items`);
                } else {
                    console.log(`   ❌ ${test.name}: ${response.status} - Access denied`);
                }
            } catch (error) {
                console.log(`   ❌ ${test.name}: Error - ${error.message}`);
            }
        }

        console.log('\n🔧 Required Scopes for Transcript Webhooks:');
        console.log('   For regular user transcripts:');
        console.log('   - meeting:transcripts_read ✅');
        console.log('   - spark:recordings_read ✅');
        console.log('');
        console.log('   For admin/organization transcripts:');
        console.log('   - meeting:admin_transcripts_read ❌ (missing)');
        console.log('   - spark:admin_recordings_read ❌ (missing)');
        
        console.log('\n💡 Solution Options:');
        console.log('   1. Add admin scopes to existing integration');
        console.log('   2. Create new integration with admin scopes');
        console.log('   3. Use organization-level webhook configuration');
        
        console.log('\n📋 Steps to Fix:');
        console.log('   1. Go to https://developer.webex.com/my-apps');
        console.log('   2. Edit your integration');
        console.log('   3. Add these scopes:');
        console.log('      - meeting:admin_transcripts_read');
        console.log('      - spark:admin_recordings_read');
        console.log('   4. Re-authorize the integration');
        console.log('   5. Update access token in settings');

    } catch (error) {
        console.error('Error:', error);
    }
}

checkIntegrationScopes();