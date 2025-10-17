import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });

async function checkWebhookStatus() {
  console.log('=== WEBHOOK STATUS CHECK ===');
  
  // List all tables to see what exists
  console.log('\n1. Available DynamoDB Tables:');
  try {
    const tablesResponse = await dynamoClient.send(new ListTablesCommand({}));
    const practiceToolsTables = tablesResponse.TableNames.filter(name => 
      name.includes('PracticeTools') && name.includes('Webex')
    );
    
    if (practiceToolsTables.length > 0) {
      practiceToolsTables.forEach(table => console.log(`   - ${table}`));
    } else {
      console.log('   No Webex-related PracticeTools tables found');
      console.log('   Available tables:', tablesResponse.TableNames.slice(0, 5).join(', '));
    }
  } catch (error) {
    console.log('Error listing tables:', error.message);
  }
  
  // Check if webhook endpoint is accessible
  console.log('\n2. Testing Webhook Endpoint:');
  try {
    const response = await fetch('http://localhost:3000/api/webex-meetings/webhook', {
      method: 'GET'
    });
    console.log(`   Webhook endpoint status: ${response.status}`);
    
    if (response.status === 405) {
      console.log('   ✅ Webhook endpoint exists (405 = Method Not Allowed for GET)');
    } else {
      const text = await response.text();
      console.log(`   Response: ${text.substring(0, 100)}`);
    }
  } catch (error) {
    console.log('   ❌ Cannot reach webhook endpoint:', error.message);
  }
  
  console.log('\n=== STATUS CHECK COMPLETE ===');
}

checkWebhookStatus().catch(console.error);