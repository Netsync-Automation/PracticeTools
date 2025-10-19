import { getValidAccessToken } from './lib/webex-token-manager.js';

async function debugTranscriptWebhooks() {
    try {
        console.log('='.repeat(60));
        console.log('TRANSCRIPT WEBHOOK DEBUG ANALYSIS');
        console.log('='.repeat(60));
        
        // Get access token
        console.log('\n1. Checking access token...');
        const accessToken = await getValidAccessToken();
        if (!accessToken) {
            console.log('❌ No access token available');
            return;
        }
        console.log('✅ Access token obtained');
        
        // List all webhooks
        console.log('\n2. Fetching all webhooks...');
        const response = await fetch('https://webexapis.com/v1/webhooks', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (!response.ok) {
            console.log(`❌ Failed to fetch webhooks: ${response.status}`);
            const errorText = await response.text();
            console.log('Error:', errorText);
            return;
        }
        
        const data = await response.json();
        const webhooks = data.items || [];
        console.log(`✅ Found ${webhooks.length} total webhooks`);
        
        // Analyze webhooks
        console.log('\n3. Analyzing webhook configuration...');
        
        const recordingsWebhooks = webhooks.filter(w => 
            w.resource === 'recordings' && w.event === 'created'
        );
        
        const transcriptWebhooks = webhooks.filter(w => 
            w.resource === 'meetingTranscripts' && w.event === 'created'
        );
        
        console.log(`\n📊 WEBHOOK SUMMARY:`);
        console.log(`   Total webhooks: ${webhooks.length}`);
        console.log(`   Recording webhooks: ${recordingsWebhooks.length}`);
        console.log(`   Transcript webhooks: ${transcriptWebhooks.length}`);
        
        // Check recordings webhooks
        console.log('\n📹 RECORDINGS WEBHOOKS:');
        if (recordingsWebhooks.length === 0) {
            console.log('   ❌ No recordings webhooks found');
        } else {
            recordingsWebhooks.forEach((webhook, i) => {
                console.log(`   ${i + 1}. ${webhook.name}`);
                console.log(`      ID: ${webhook.id}`);
                console.log(`      Status: ${webhook.status}`);
                console.log(`      Target: ${webhook.targetUrl}`);
                console.log(`      Created: ${webhook.created}`);
            });
        }
        
        // Check transcript webhooks
        console.log('\n📝 TRANSCRIPT WEBHOOKS:');
        if (transcriptWebhooks.length === 0) {
            console.log('   ❌ No transcript webhooks found');
            console.log('   🔧 This is likely the root cause of the transcript issue!');
        } else {
            transcriptWebhooks.forEach((webhook, i) => {
                console.log(`   ${i + 1}. ${webhook.name}`);
                console.log(`      ID: ${webhook.id}`);
                console.log(`      Status: ${webhook.status}`);
                console.log(`      Target: ${webhook.targetUrl}`);
                console.log(`      Created: ${webhook.created}`);
            });
        }
        
        // Show all webhooks for reference
        console.log('\n📋 ALL WEBHOOKS:');
        webhooks.forEach((webhook, i) => {
            console.log(`   ${i + 1}. ${webhook.name}`);
            console.log(`      Resource: ${webhook.resource}`);
            console.log(`      Event: ${webhook.event}`);
            console.log(`      Status: ${webhook.status}`);
            console.log(`      Target: ${webhook.targetUrl}`);
            console.log('');
        });
        
        // Recommendations
        console.log('\n💡 RECOMMENDATIONS:');
        if (transcriptWebhooks.length === 0) {
            console.log('   1. ❗ Create transcript webhooks using the admin settings');
            console.log('   2. 🔧 Go to Admin → Settings → Company EDU → Setup Webhooks');
            console.log('   3. ✅ Verify webhook creation was successful');
        } else {
            const activeTranscriptWebhooks = transcriptWebhooks.filter(w => w.status === 'active');
            if (activeTranscriptWebhooks.length === 0) {
                console.log('   1. ⚠️  Transcript webhooks exist but are not active');
                console.log('   2. 🔧 Check webhook status and reactivate if needed');
            } else {
                console.log('   1. ✅ Transcript webhooks are properly configured');
                console.log('   2. 🔍 Issue may be elsewhere - check recent logs for transcript events');
            }
        }
        
        console.log('\n' + '='.repeat(60));
        
    } catch (error) {
        console.error('Debug error:', error);
        console.error('Stack:', error.stack);
    }
}

debugTranscriptWebhooks();