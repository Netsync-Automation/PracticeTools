import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const client = new DynamoDBClient({ region: 'us-east-1' });

async function checkAllSites() {
    try {
        console.log('🔍 Scanning all sites in both dev and prod environments...\n');
        
        // Check both environments
        const environments = ['dev', 'prod'];
        
        for (const env of environments) {
            console.log(`📋 Checking ${env.toUpperCase()} environment:`);
            console.log(`Table: PracticeTools-${env}-Sites\n`);
            
            try {
                const params = {
                    TableName: `PracticeTools-${env}-Sites`
                };

                const result = await client.send(new ScanCommand(params));
                
                if (!result.Items || result.Items.length === 0) {
                    console.log(`❌ No sites found in ${env} environment\n`);
                    continue;
                }

                console.log(`✅ Found ${result.Items.length} sites in ${env} environment:`);
                
                for (const item of result.Items) {
                    const site = unmarshall(item);
                    console.log(`\n🌐 Site: ${site.siteUrl}`);
                    
                    if (site.recordingHosts) {
                        console.log('📧 Recording Hosts:');
                        for (const host of site.recordingHosts) {
                            if (typeof host === 'string') {
                                console.log(`   - ${host} (string - no userId)`);
                            } else if (host.email) {
                                console.log(`   - ${host.email} ${host.userId ? `(userId: ${host.userId})` : '(no userId)'}`);
                            } else {
                                console.log(`   - ${JSON.stringify(host)}`);
                            }
                        }
                    } else {
                        console.log('📧 No recording hosts configured');
                    }
                }
                console.log('\n' + '='.repeat(50) + '\n');
                
            } catch (error) {
                console.log(`❌ Error accessing ${env} table: ${error.message}\n`);
            }
        }
        
    } catch (error) {
        console.error('❌ General error:', error.message);
    }
}

checkAllSites();