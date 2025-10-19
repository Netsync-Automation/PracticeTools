import { getValidAccessToken } from './lib/webex-token-manager.js';

async function debugTranscriptWebhookIssue() {
    try {
        console.log('🔍 Debugging transcript webhook issue...\n');
        
        const accessToken = await getValidAccessToken();
        
        // 1. Check current webhooks
        console.log('1. Checking current webhook configuration...');
        const webhooksResponse = await fetch('https://webexapis.com/v1/webhooks', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (webhooksResponse.ok) {
            const webhooksData = await webhooksResponse.json();
            const webhooks = webhooksData.items || [];
            
            console.log(`   Found ${webhooks.length} webhooks:`);
            webhooks.forEach(webhook => {
                console.log(`   - ${webhook.name}: ${webhook.resource}/${webhook.event} → ${webhook.targetUrl}`);
                console.log(`     Status: ${webhook.status}, Created: ${webhook.created}`);
            });
        }
        
        // 2. Test admin transcript access with specific meeting
        console.log('\n2. Testing admin transcript access...');
        const adminResponse = await fetch('https://webexapis.com/v1/admin/meetingTranscripts?max=10', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        console.log(`   Admin API Status: ${adminResponse.status}`);
        
        if (adminResponse.ok) {
            const data = await adminResponse.json();
            console.log(`   ✅ Found ${data.items?.length || 0} admin transcripts`);
            
            if (data.items?.length > 0) {
                console.log('\n   📝 Recent admin transcripts:');
                data.items.slice(0, 3).forEach((transcript, i) => {
                    console.log(`      ${i + 1}. ID: ${transcript.id}`);
                    console.log(`         Meeting: ${transcript.meetingId}`);
                    console.log(`         Created: ${transcript.created}`);
                    console.log(`         Host: ${transcript.hostEmail || 'N/A'}`);
                });
                
                console.log('\n   💡 Transcripts exist but no webhooks received!');
                console.log('   This suggests Webex is not sending transcript webhooks.');
            }
        } else {
            const errorText = await adminResponse.text();
            console.log(`   ❌ Admin access failed: ${errorText}`);
        }
        
        // 3. Check if webhooks need to be recreated
        console.log('\n3. Potential solutions:');
        console.log('   a) Delete and recreate transcript webhooks');
        console.log('   b) Check if webhook needs admin-level permissions');
        console.log('   c) Verify webhook is created with admin token');
        console.log('   d) Check Webex organization settings for transcript webhooks');
        
        console.log('\n💡 Try recreating webhooks with admin scopes:');
        console.log('   1. Go to Admin → Settings → Company EDU');
        console.log('   2. Click "Setup Webhooks" to recreate them');
        console.log('   3. This will use current token with admin scopes');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

debugTranscriptWebhookIssue();