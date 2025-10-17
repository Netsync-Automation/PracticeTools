import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

async function checkWebhookLogs() {
  const client = new DynamoDBClient({ region: 'us-east-1' });
  const docClient = DynamoDBDocumentClient.from(client);
  
  // Check if there's a webhook logs table
  const logTables = ['webhook_logs', 'webex_webhook_logs', 'logs'];
  
  for (const table of logTables) {
    const tableName = `PracticeTools-dev-${table}`;
    console.log(`\n=== Checking ${tableName} ===`);
    
    try {
      const command = new ScanCommand({
        TableName: tableName,
        Limit: 5
      });
      
      const result = await docClient.send(command);
      console.log(`Items found: ${result.Items?.length || 0}`);
      
      if (result.Items && result.Items.length > 0) {
        result.Items.forEach((item, index) => {
          console.log(`\nLog ${index + 1}:`);
          console.log(JSON.stringify(item, null, 2));
        });
      }
    } catch (error) {
      console.log(`Error: ${error.message}`);
    }
  }
}

checkWebhookLogs().catch(console.error);