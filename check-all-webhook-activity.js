import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

async function checkAllWebhookActivity() {
    try {
        console.log('🔍 Checking ALL webhook activity (including failed attempts)...\n');
        
        const result = await docClient.send(new ScanCommand({
            TableName: 'PracticeTools-dev-webex_logs'
        }));

        const logs = (result.Items || [])
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 50); // Get last 50 events

        console.log(`📊 Found ${logs.length} total webhook events\n`);
        
        // Group by event type
        const eventTypes = {};
        logs.forEach(log => {
            if (!eventTypes[log.event]) eventTypes[log.event] = 0;
            eventTypes[log.event]++;
        });
        
        console.log('📈 Event Type Summary:');
        Object.entries(eventTypes).forEach(([event, count]) => {
            console.log(`   ${event}: ${count}`);
        });
        
        console.log('\n📋 Recent Events:');
        console.log('='.repeat(80));
        
        logs.forEach((log, index) => {
            console.log(`\n${index + 1}. [${log.timestamp}] ${log.event} - ${log.status}`);
            
            if (log.details && typeof log.details === 'object') {
                // Show key details
                if (log.details.payload) {
                    const payload = log.details.payload;
                    console.log(`   Resource: ${payload.resource || 'N/A'}`);
                    console.log(`   Event: ${payload.event || 'N/A'}`);
                    if (payload.data?.id) console.log(`   Data ID: ${payload.data.id}`);
                }
                if (log.details.requestId) console.log(`   Request ID: ${log.details.requestId}`);
                if (log.details.headers) {
                    const userAgent = log.details.headers['user-agent'];
                    if (userAgent) console.log(`   User-Agent: ${userAgent}`);
                }
                if (log.details.recordingId) console.log(`   Recording ID: ${log.details.recordingId}`);
                if (log.details.transcriptId) console.log(`   Transcript ID: ${log.details.transcriptId}`);
                if (log.details.error) console.log(`   Error: ${log.details.error}`);
                if (log.details.processingTime) console.log(`   Processing Time: ${log.details.processingTime}ms`);
            }
        });
        
        // Check specifically for transcript webhook attempts
        const transcriptEvents = logs.filter(log => 
            log.event.includes('transcript') || 
            (log.details?.payload?.resource === 'meetingTranscripts')
        );
        
        console.log('\n' + '='.repeat(80));
        console.log(`🔍 TRANSCRIPT WEBHOOK ANALYSIS:`);
        console.log(`   Total transcript-related events: ${transcriptEvents.length}`);
        
        if (transcriptEvents.length === 0) {
            console.log('   ❌ NO TRANSCRIPT WEBHOOK ATTEMPTS FOUND');
            console.log('   This means Webex is NOT sending transcript webhooks at all');
            console.log('   Possible causes:');
            console.log('   1. Webhook not properly registered with Webex');
            console.log('   2. Webex not generating transcript webhooks');
            console.log('   3. Webhook URL not accessible from Webex');
            console.log('   4. Integration missing required permissions');
        } else {
            console.log('   ✅ Transcript webhook attempts found:');
            transcriptEvents.forEach((event, i) => {
                console.log(`      ${i + 1}. ${event.timestamp} - ${event.event} (${event.status})`);
            });
        }
        
        // Check for any webhook attempts from Webex (by User-Agent)
        const webexAttempts = logs.filter(log => 
            log.details?.headers?.['user-agent']?.includes('Webex') ||
            log.details?.headers?.['user-agent']?.includes('Cisco')
        );
        
        console.log(`\n🌐 WEBEX WEBHOOK ATTEMPTS:`);
        console.log(`   Requests from Webex: ${webexAttempts.length}`);
        
        if (webexAttempts.length > 0) {
            console.log('   Recent Webex requests:');
            webexAttempts.slice(0, 5).forEach((attempt, i) => {
                const userAgent = attempt.details?.headers?.['user-agent'] || 'Unknown';
                console.log(`      ${i + 1}. ${attempt.timestamp} - ${userAgent}`);
            });
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

checkAllWebhookActivity();