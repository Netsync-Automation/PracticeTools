import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

async function checkWebexTables() {
  const client = new DynamoDBClient({ region: 'us-east-1' });
  
  const tables = ['webex_recordings', 'webex_meetings', 'webex_transcripts', 'webex_hosts', 'webex_logs'];
  
  for (const table of tables) {
    const tableName = `PracticeTools-dev-${table}`;
    console.log(`\n=== Checking ${tableName} ===`);
    
    try {
      const command = new ScanCommand({
        TableName: tableName,
        Limit: 10
      });
      
      const result = await client.send(command);
      console.log(`Items found: ${result.Items?.length || 0}`);
      
      if (result.Items && result.Items.length > 0) {
        result.Items.forEach((item, index) => {
          console.log(`\nItem ${index + 1}:`);
          console.log(JSON.stringify(item, null, 2));
        });
      }
    } catch (error) {
      console.log(`Error: ${error.message}`);
    }
  }
}

checkWebexTables().catch(console.error);