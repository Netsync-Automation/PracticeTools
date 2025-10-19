async function testWebhookAccessibility() {
    try {
        console.log('🔍 Testing webhook URL accessibility...\n');
        
        const webhookUrl = 'https://czpifmw72k.us-east-1.awsapprunner.com/api/webex-meetings/webhook';
        
        // Test if webhook URL is accessible from external
        console.log(`📡 Testing webhook URL: ${webhookUrl}`);
        
        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ test: 'connectivity' })
            });
            
            console.log(`📊 Webhook URL Status: ${response.status}`);
            
            if (response.ok || response.status === 400) {
                console.log('✅ Webhook URL is accessible from external');
            } else {
                console.log('❌ Webhook URL may not be accessible');
            }
        } catch (error) {
            console.log(`❌ Webhook URL not accessible: ${error.message}`);
        }
        
        // Check if we can find any transcript webhooks that might have been missed
        console.log('\n🔍 Checking for any transcript-related webhook events...');
        
        // This would need to be run on the server to access DynamoDB
        console.log('💡 Run this on server: node check-transcript-logs.js');
        
        console.log('\n🧪 Possible issues:');
        console.log('1. Webex not sending transcript webhooks (even with correct scopes)');
        console.log('2. Transcript webhooks being sent to wrong URL');
        console.log('3. Transcript webhooks being filtered out');
        console.log('4. Transcripts not being generated for meetings');
        console.log('5. Webhook processing failing silently');
        
        console.log('\n💡 Next steps:');
        console.log('1. Check if transcripts exist in Webex UI for recent meetings');
        console.log('2. Verify webhook URL in Webex developer portal matches current URL');
        console.log('3. Test with a fresh meeting that has transcription enabled');
        console.log('4. Check webhook logs for any failed processing');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testWebhookAccessibility();