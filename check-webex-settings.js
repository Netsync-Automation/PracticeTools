import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getEnvironment, getTableName } from './lib/dynamodb.js';

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

async function checkWebexSettings() {
    try {
        console.log('🔍 Checking Webex Meetings settings in database...\n');
        
        const env = getEnvironment();
        const tableName = getTableName('Settings');
        
        console.log('Environment:', env);
        console.log('Table name:', tableName);
        
        const command = new GetCommand({
            TableName: tableName,
            Key: { setting_key: 'webex-meetings' }
        });

        console.log('DynamoDB query params:', JSON.stringify(command.input, null, 2));

        const result = await docClient.send(command);
        
        if (!result.Item) {
            console.log('❌ Webex Meetings settings not found in database');
            console.log('This means the save operation never completed successfully.');
            return;
        }

        console.log('📋 Webex Meetings settings found!');
        console.log('Raw setting value:', result.Item.setting_value);
        
        const parsedData = JSON.parse(result.Item.setting_value);
        console.log('\n📊 Parsed settings:');
        console.log('Enabled:', parsedData.enabled);
        console.log('Sites count:', parsedData.sites?.length || 0);
        
        if (parsedData.sites && parsedData.sites.length > 0) {
            console.log('\n🌐 Sites details:');
            parsedData.sites.forEach((site, index) => {
                console.log(`\nSite ${index + 1}:`);
                console.log('  Site URL:', site.siteUrl);
                console.log('  Site Name:', site.siteName);
                console.log('  Recording Hosts:', JSON.stringify(site.recordingHosts, null, 4));
                
                if (site.recordingHosts && Array.isArray(site.recordingHosts)) {
                    console.log('\n  📧 Recording Host Analysis:');
                    site.recordingHosts.forEach((host, hostIndex) => {
                        if (typeof host === 'string') {
                            console.log(`    Host ${hostIndex + 1}: ${host} (string format - no userId)`);
                        } else if (host.email && host.userId) {
                            console.log(`    Host ${hostIndex + 1}: ${host.email} (userId: ${host.userId}) ✅`);
                        } else if (host.email) {
                            console.log(`    Host ${hostIndex + 1}: ${host.email} (no userId) ❌`);
                        } else {
                            console.log(`    Host ${hostIndex + 1}: Invalid format - ${JSON.stringify(host)}`);
                        }
                    });
                }
            });
        }
        
        console.log('\n📅 Last updated:', result.Item.updated_at);
        
    } catch (error) {
        console.error('❌ Error checking database:', error.message);
        console.error('Error details:', error);
    }
}

checkWebexSettings();