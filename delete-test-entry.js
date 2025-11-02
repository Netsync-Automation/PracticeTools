import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function deleteTestEntries() {
  const result = await docClient.send(new ScanCommand({
    TableName: 'PracticeTools-dev-WebexMessages',
    FilterExpression: 'begins_with(message_id, :prefix)',
    ExpressionAttributeValues: { ':prefix': 'test-' }
  }));

  for (const item of result.Items || []) {
    await docClient.send(new DeleteCommand({
      TableName: 'PracticeTools-dev-WebexMessages',
      Key: { message_id: item.message_id }
    }));
    console.log(`✓ Deleted test entry: ${item.message_id}`);
  }
  
  console.log(`\n✓ Cleanup complete. Deleted ${result.Items?.length || 0} test entries.`);
}

deleteTestEntries().catch(console.error);
