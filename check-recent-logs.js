import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const region = 'us-east-1';
const dynamodb = new DynamoDBClient({ region });

async function checkRecentWebexLogs() {
    console.log('=== RECENT WEBEX LOGS (Last 24 hours) ===');
    
    try {
        const scanCommand = new ScanCommand({
            TableName: 'PracticeTools-dev-webex_logs'
        });
        
        const response = await dynamodb.send(scanCommand);
        
        if (response.Items && response.Items.length > 0) {
            // Sort by timestamp (most recent first)
            const logs = response.Items
                .map(item => unmarshall(item))
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, 20); // Show last 20 events
            
            console.log(`Found ${logs.length} recent log events:\\n`);
            
            logs.forEach(log => {
                console.log(`[${log.timestamp}] ${log.event} (${log.status})`);
                if (log.details) {
                    if (log.event === 'host_lookup') {
                        console.log(`  Host ID: ${log.details.hostUserId}`);
                        console.log(`  Host Email: ${log.details.hostEmail || 'NULL'}`);
                    } else if (log.event === 'filtered') {
                        console.log(`  Reason: ${log.details.reason}`);
                        if (log.details.monitoredHosts) {
                            console.log(`  Monitored hosts: ${log.details.monitoredHosts.join(', ')}`);
                        }
                    } else if (log.event === 'error' || log.event === 'token_error') {
                        console.log(`  Error: ${log.details.error || 'Unknown error'}`);
                    }
                }
                console.log('');
            });
        } else {
            console.log('No webhook logs found');
        }
    } catch (error) {
        console.error('Error checking webhook logs:', error.message);
    }
}

checkRecentWebexLogs().catch(console.error);