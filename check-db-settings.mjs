import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

async function checkWebexMeetingsSettings() {
  try {
    console.log('🔍 Checking webex-meetings settings in database...');
    
    const command = new GetCommand({
      TableName: 'PracticeTools-dev-Settings',
      Key: {
        setting_key: 'webex-meetings'
      }
    });
    
    const result = await docClient.send(command);
    
    if (!result.Item) {
      console.log('❌ No webex-meetings settings found in database');
      return;
    }
    
    console.log('✅ Found webex-meetings settings');
    
    const settingsValue = JSON.parse(result.Item.setting_value);
    console.log('\n📊 Settings structure:');
    console.log('- Enabled:', settingsValue.enabled);
    console.log('- Sites count:', settingsValue.sites?.length || 0);
    
    if (settingsValue.sites && settingsValue.sites.length > 0) {
      settingsValue.sites.forEach((site, index) => {
        console.log(`\n🌐 Site ${index + 1}: ${site.siteUrl}`);
        console.log('- Site Name:', site.siteName || 'N/A');
        console.log('- Recording Hosts count:', site.recordingHosts?.length || 0);
        
        if (site.recordingHosts && site.recordingHosts.length > 0) {
          site.recordingHosts.forEach((host, hostIndex) => {
            console.log(`  📧 Host ${hostIndex + 1}:`);
            if (typeof host === 'string') {
              console.log(`    ❌ ISSUE: Still stored as string: "${host}"`);
            } else if (host && typeof host === 'object') {
              console.log(`    ✅ Properly stored as object:`);
              console.log(`       - Email: ${host.email || 'N/A'}`);
              console.log(`       - UserID: ${host.userId || 'N/A'}`);
            } else {
              console.log(`    ❓ Unknown format:`, host);
            }
          });
        }
      });
    }
    
    console.log('\n📝 Raw JSON data:');
    console.log(JSON.stringify(settingsValue, null, 2));
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
  }
}

checkWebexMeetingsSettings();