import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1'
});

async function queryIssue54() {
  try {
    console.log('Querying DynamoDB for issue #54...');
    
    const command = new ScanCommand({
      TableName: 'PracticeTools-Issues',
      FilterExpression: 'issue_number = :num',
      ExpressionAttributeValues: {
        ':num': { N: '54' }
      }
    });
    
    const result = await client.send(command);
    
    if (result.Items && result.Items.length > 0) {
      const issue = result.Items[0];
      console.log('\n=== Issue #54 Found ===');
      console.log(`Status: ${issue.status?.S || 'Unknown'}`);
      console.log(`Title: ${issue.title?.S || 'No title'}`);
      console.log(`Created: ${issue.created_at?.S || 'Unknown'}`);
      console.log(`Last Updated: ${issue.last_updated_at?.S || 'Unknown'}`);
      console.log(`Admin: ${issue.admin_username?.S || 'None'}`);
      console.log(`Upvotes: ${issue.upvotes?.N || '0'}`);
    } else {
      console.log('Issue #54 not found in database');
    }
  } catch (error) {
    console.error('Error querying DynamoDB:', error.message);
  }
}

queryIssue54();