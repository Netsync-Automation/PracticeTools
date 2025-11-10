import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getTableName } from './lib/dynamodb.js';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function checkRoomConfig() {
  const roomId = 'Y2lzY29zcGFyazovL3VzL1JPT00vNDkwNmJhNDAtYjVhZS0xMWYwLWJkNmItYzU0NTEwMGE3OTU5';
  
  console.log('Looking for roomId:', roomId);
  console.log('');
  
  const tableName = getTableName('Settings');
  console.log('Checking table:', tableName);
  
  const command = new GetCommand({
    TableName: tableName,
    Key: { setting_key: 'webex-meetings' }
  });
  
  const result = await docClient.send(command);
  
  if (!result.Item) {
    console.log('❌ No webex-meetings settings found!');
    return;
  }
  
  console.log('✓ Found webex-meetings settings');
  const config = JSON.parse(result.Item.setting_value);
  
  console.log('\n=== SITES ===');
  console.log('Number of sites:', config.sites?.length || 0);
  
  for (const site of config.sites || []) {
    console.log('\n--- Site:', site.siteUrl);
    console.log('Monitored rooms:', site.monitoredRooms?.length || 0);
    
    for (const room of site.monitoredRooms || []) {
      console.log('  - Room ID:', room.id);
      console.log('    Room Name:', room.name);
      
      if (room.id === roomId) {
        console.log('    ✓✓✓ THIS IS THE ROOM FROM THE WEBHOOK! ✓✓✓');
      }
    }
  }
  
  // Now test the lookup function
  console.log('\n=== TESTING LOOKUP FUNCTION ===');
  let foundSite = null;
  for (const site of config.sites || []) {
    if (site.monitoredRooms?.find(r => r.id === roomId)) {
      foundSite = site.siteUrl;
      break;
    }
  }
  
  if (foundSite) {
    console.log('✓ Lookup would return:', foundSite);
  } else {
    console.log('❌ Lookup would return: null (ROOM NOT FOUND IN CONFIG)');
  }
}

checkRoomConfig();
