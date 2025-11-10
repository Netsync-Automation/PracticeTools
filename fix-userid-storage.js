import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { getEnvironment, getTableName } from './lib/dynamodb.js';
import { getValidAccessToken } from './lib/webex-token-manager.js';

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

async function fixUserIdStorage() {
    try {
        console.log('🔧 Fixing userId storage for netsync.webex.com...\n');
        
        // Get current settings
        const tableName = getTableName('Settings');
        const getCommand = new GetCommand({
            TableName: tableName,
            Key: { setting_key: 'webex-meetings' }
        });
        
        const result = await docClient.send(getCommand);
        if (!result.Item) {
            console.log('❌ Webex Meetings settings not found');
            return;
        }
        
        const parsedData = JSON.parse(result.Item.setting_value);
        console.log('📋 Current settings loaded');
        
        // Find netsync.webex.com site
        const siteIndex = parsedData.sites.findIndex(site => site.siteUrl === 'netsync.webex.com');
        if (siteIndex === -1) {
            console.log('❌ netsync.webex.com site not found');
            return;
        }
        
        const site = parsedData.sites[siteIndex];
        console.log('🌐 Found site:', site.siteUrl);
        console.log('📧 Current recording hosts:', JSON.stringify(site.recordingHosts, null, 2));
        
        // Get access token
        const accessToken = await getValidAccessToken(site.siteUrl);
        if (!accessToken) {
            console.log('❌ No valid access token available');
            return;
        }
        
        // Resolve emails to userIds
        console.log('\n🔍 Resolving emails to user IDs...');
        const resolvedHosts = [];
        
        for (const hostItem of site.recordingHosts) {
            const email = typeof hostItem === 'string' ? hostItem : hostItem.email;
            const hostEntry = { email };
            
            if (typeof hostItem === 'object' && hostItem.userId) {
                hostEntry.userId = hostItem.userId;
                console.log(`✅ Using existing user ID for ${email}: ${hostEntry.userId}`);
            } else {
                try {
                    console.log(`🔍 Resolving ${email}...`);
                    const userResponse = await fetch(`https://webexapis.com/v1/people?email=${encodeURIComponent(email)}`, {
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    });
                    
                    if (userResponse.ok) {
                        const userData = await userResponse.json();
                        if (userData.items && userData.items.length > 0) {
                            hostEntry.userId = userData.items[0].id;
                            console.log(`✅ Resolved ${email} to user ID: ${hostEntry.userId}`);
                        } else {
                            console.log(`❌ No user found for ${email}`);
                        }
                    } else {
                        console.log(`❌ API error for ${email}: ${userResponse.status}`);
                    }
                } catch (error) {
                    console.error(`❌ Error resolving ${email}:`, error.message);
                }
            }
            
            resolvedHosts.push(hostEntry);
        }
        
        // Update the site with resolved hosts
        parsedData.sites[siteIndex].recordingHosts = resolvedHosts;
        
        console.log('\n💾 Saving updated settings...');
        console.log('📧 New recording hosts format:', JSON.stringify(resolvedHosts, null, 2));
        
        const putCommand = new PutCommand({
            TableName: tableName,
            Item: {
                setting_key: 'webex-meetings',
                setting_value: JSON.stringify(parsedData),
                updated_at: new Date().toISOString()
            }
        });
        
        await docClient.send(putCommand);
        console.log('✅ Settings updated successfully!');
        
        // Verify the save
        console.log('\n🔍 Verifying the save...');
        const verifyResult = await docClient.send(getCommand);
        const verifiedData = JSON.parse(verifyResult.Item.setting_value);
        const verifiedSite = verifiedData.sites.find(s => s.siteUrl === 'netsync.webex.com');
        
        console.log('📊 Verification results:');
        verifiedSite.recordingHosts.forEach((host, index) => {
            if (host.email && host.userId) {
                console.log(`✅ Host ${index + 1}: ${host.email} (userId: ${host.userId})`);
            } else {
                console.log(`❌ Host ${index + 1}: ${JSON.stringify(host)} (missing userId)`);
            }
        });
        
    } catch (error) {
        console.error('❌ Error fixing userId storage:', error.message);
    }
}

fixUserIdStorage();