import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getTableName } from './lib/dynamodb.js';

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function checkMonitoredHosts() {
  console.log('=== CHECKING MONITORED HOSTS ===');
  
  try {
    const tableName = getTableName('webex_hosts');
    console.log('Checking table:', tableName);
    
    const response = await docClient.send(new ScanCommand({ TableName: tableName }));
    const hosts = (response.Items || []).map(h => h.email);
    
    console.log('Monitored hosts found:', hosts.length);
    hosts.forEach((host, i) => {
      console.log(`${i + 1}. ${host}`);
    });
    
    if (hosts.length === 0) {
      console.log('\n❌ No monitored hosts configured!');
      console.log('This is why webhook events are being filtered out.');
      console.log('Add hosts via the admin interface or API.');
    } else {
      console.log('\n✅ Monitored hosts are configured');
    }
    
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      console.log('❌ webex_hosts table does not exist');
      console.log('This means no hosts have been configured for monitoring');
    } else {
      console.log('Error checking hosts:', error.message);
    }
  }
}

checkMonitoredHosts().catch(console.error);