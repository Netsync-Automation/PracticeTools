import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({ region: 'us-east-1' });

async function main() {
  const result = await client.send(new ListTablesCommand({}));
  const tables = result.TableNames || [];
  
  console.log('\n=== All DynamoDB Tables ===\n');
  tables.sort().forEach(table => console.log(`  ${table}`));
  
  console.log('\n=== Webex-related Tables ===\n');
  const webexTables = tables.filter(t => t.toLowerCase().includes('webex'));
  webexTables.forEach(table => console.log(`  ${table}`));
  
  console.log('\n=== Required Tables Check ===\n');
  const required = [
    'PracticeTools-dev-Settings',
    'PracticeTools-dev-WebexMessages',
    'PracticeTools-dev-WebexMeetingsWebhookLogs'
  ];
  
  required.forEach(table => {
    const exists = tables.includes(table);
    console.log(`  ${exists ? '✓' : '✗'} ${table}`);
  });
}

main().catch(console.error);
