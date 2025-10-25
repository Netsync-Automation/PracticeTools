import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const client = new DynamoDBClient({ region: 'us-east-1' });

async function checkUserIdStorage() {
    try {
        console.log('🔍 Checking if userIds were stored for netsync.webex.com...\n');
        
        const params = {
            TableName: 'PracticeTools-prod-Sites',
            Key: marshall({
                siteUrl: 'netsync.webex.com'
            })
        };

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
        const expectedEmails = ['mbgriffin@netsync.com', 'jengle@netsync.com'];
        let allHaveUserIds = true;
        
        console.log('\n🔍 Checking userId storage:');
        
        if (site.recordingHosts && Array.isArray(site.recordingHosts)) {
            for (const host of site.recordingHosts) {
                if (typeof host === 'string') {
                    console.log(`❌ ${host}: Still stored as string (no userId)`);
                    allHaveUserIds = false;
                } else if (host.email && host.userId) {
                    console.log(`✅ ${host.email}: Has userId = ${host.userId}`);
                } else {
                    console.log(`⚠️  ${JSON.stringify(host)}: Invalid format`);
                    allHaveUserIds = false;
                }
            }
        } else {
            console.log('❌ No recordingHosts found or invalid format');
            allHaveUserIds = false;
        }
        
        console.log('\n📊 Summary:');
        if (allHaveUserIds) {
            console.log('✅ SUCCESS: All recording hosts have userIds stored');
        } else {
            console.log('❌ ISSUE: Some recording hosts are missing userIds');
            console.log('💡 This means the People API resolution may not have triggered during save');
        }
        
    } catch (error) {
        console.error('❌ Error checking database:', error.message);
    }
}

checkUserIdStorage();