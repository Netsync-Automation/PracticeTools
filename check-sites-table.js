import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { getEnvironment, getTableName } from './lib/dynamodb.js';

const client = new DynamoDBClient({ region: 'us-east-1' });

async function checkSitesTable() {
    try {
        console.log('🔍 Checking Sites table for netsync.webex.com...\n');
        
        const env = getEnvironment();
        const tableName = getTableName('Sites');
        
        console.log('Environment:', env);
        console.log('Table name:', tableName);
        
        const params = {
            TableName: tableName,
            Key: marshall({
                siteUrl: 'netsync.webex.com'
            })
        };

        console.log('DynamoDB query params:', JSON.stringify(params, null, 2));

        const result = await client.send(new GetItemCommand(params));
        
        if (!result.Item) {
            console.log('❌ Site not found in database');
            return;
        }

        const site = unmarshall(result.Item);
        console.log('📋 Site data retrieved:');
        console.log('Site URL:', site.siteUrl);
        console.log('Recording Hosts:', JSON.stringify(site.recordingHosts, null, 2));
        
        // Check if both emails have userIds
        console.log('\n🔍 Checking userId storage:');
        
        if (site.recordingHosts && Array.isArray(site.recordingHosts)) {
            for (const host of site.recordingHosts) {
                if (typeof host === 'string') {
                    console.log(`❌ ${host}: Still stored as string (no userId)`);
                } else if (host.email && host.userId) {
                    console.log(`✅ ${host.email}: Has userId = ${host.userId}`);
                } else {
                    console.log(`⚠️  ${JSON.stringify(host)}: Invalid format`);
                }
            }
        } else {
            console.log('❌ No recordingHosts found or invalid format');
        }
        
    } catch (error) {
        console.error('❌ Error checking database:', error.message);
        console.error('Error details:', error);
    }
}

checkSitesTable();