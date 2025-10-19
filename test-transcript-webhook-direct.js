import { getValidAccessToken } from './lib/webex-token-manager.js';

async function testTranscriptWebhookDirect() {
    try {
        console.log('='.repeat(60));
        console.log('DIRECT TRANSCRIPT WEBHOOK TEST');
        console.log('='.repeat(60));
        
        const accessToken = await getValidAccessToken();
        if (!accessToken) {
            console.log('❌ No access token available');
            return;
        }
        
        // Test if we can manually trigger a transcript webhook by checking recent meetings
        console.log('\n1. Fetching recent recordings to check for transcripts...');
        
        const recordingsResponse = await fetch('https://webexapis.com/v1/recordings?max=10', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (!recordingsResponse.ok) {
            console.log(`❌ Failed to fetch recordings: ${recordingsResponse.status}`);
            return;
        }
        
        const recordingsData = await recordingsResponse.json();
        const recordings = recordingsData.items || [];
        
        console.log(`✅ Found ${recordings.length} recent recordings`);
        
        for (const recording of recordings.slice(0, 3)) {
            console.log(`\n📹 Recording: ${recording.topic || 'Untitled'}`);
            console.log(`   ID: ${recording.id}`);
            console.log(`   Meeting ID: ${recording.meetingId}`);
            console.log(`   Created: ${recording.timeRecorded}`);
            
            // Check if transcripts exist for this meeting
            if (recording.meetingId && recording.meetingId.includes('_I_')) {
                console.log(`   🔍 Checking transcripts for meeting instance: ${recording.meetingId}`);
                
                const transcriptResponse = await fetch(`https://webexapis.com/v1/meetingTranscripts?meetingId=${recording.meetingId}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                
                if (transcriptResponse.ok) {
                    const transcriptData = await transcriptResponse.json();
                    const transcripts = transcriptData.items || [];
                    
                    console.log(`   📝 Transcripts found: ${transcripts.length}`);
                    
                    if (transcripts.length > 0) {
                        const transcript = transcripts[0];
                        console.log(`      Transcript ID: ${transcript.id}`);
                        console.log(`      Created: ${transcript.created}`);
                        console.log(`      Status: ${transcript.status || 'available'}`);
                        
                        // This transcript should have triggered a webhook
                        console.log(`   ⚠️  This transcript should have triggered a webhook!`);
                        
                        // Test if we can simulate the webhook
                        console.log(`   🧪 Simulating transcript webhook...`);
                        
                        const webhookPayload = {
                            resource: 'meetingTranscripts',
                            event: 'created',
                            data: {
                                id: transcript.id,
                                meetingId: recording.meetingId
                            },
                            created: transcript.created
                        };
                        
                        console.log(`   📤 Webhook payload:`, JSON.stringify(webhookPayload, null, 2));
                        
                        // Test our webhook endpoint
                        try {
                            const webhookResponse = await fetch('http://localhost:3000/api/webex-meetings/webhook', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(webhookPayload)
                            });
                            
                            if (webhookResponse.ok) {
                                console.log(`   ✅ Webhook simulation successful`);
                            } else {
                                console.log(`   ❌ Webhook simulation failed: ${webhookResponse.status}`);
                            }
                        } catch (webhookError) {
                            console.log(`   ⚠️  Could not test webhook locally: ${webhookError.message}`);
                        }
                    } else {
                        console.log(`   ℹ️  No transcripts available yet (may still be processing)`);
                    }
                } else {
                    console.log(`   ❌ Failed to fetch transcripts: ${transcriptResponse.status}`);
                }
            } else {
                console.log(`   ⚠️  Invalid meeting ID format: ${recording.meetingId}`);
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('ANALYSIS SUMMARY:');
        console.log('='.repeat(60));
        console.log('1. If transcripts exist but no webhooks were received:');
        console.log('   - Webex may not be sending transcript webhooks');
        console.log('   - Check webhook URL accessibility from Webex');
        console.log('   - Verify webhook permissions and scopes');
        console.log('');
        console.log('2. If no transcripts exist:');
        console.log('   - Transcription may not be enabled for meetings');
        console.log('   - Meetings may be too short to generate transcripts');
        console.log('   - Transcripts may still be processing');
        console.log('');
        console.log('3. Recommended next steps:');
        console.log('   - Enable transcription in Webex meeting settings');
        console.log('   - Test with a longer meeting (>5 minutes)');
        console.log('   - Check webhook URL is publicly accessible');
        console.log('   - Monitor logs for incoming transcript webhooks');
        
    } catch (error) {
        console.error('Test error:', error);
    }
}

testTranscriptWebhookDirect();