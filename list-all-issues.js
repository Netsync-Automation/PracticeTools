import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1'
});

async function listAllIssues() {
  try {
    console.log('Scanning all issues in DynamoDB...');
    
    const command = new ScanCommand({
      TableName: 'PracticeTools-Issues'
    });
    
    const result = await client.send(command);
    
    if (result.Items && result.Items.length > 0) {
      console.log(`\nFound ${result.Items.length} issues:`);
      
      // Sort by issue number
      const issues = result.Items.map(item => ({
        number: parseInt(item.issue_number?.N || '0'),
        status: item.status?.S || 'Unknown',
        title: item.title?.S || 'No title',
        created: item.created_at?.S || 'Unknown',
        updated: item.last_updated_at?.S || 'Unknown'
      })).sort((a, b) => a.number - b.number);
      
      // Look for issue #54 specifically
      const issue54 = issues.find(issue => issue.number === 54);
      
      if (issue54) {
        console.log('\n=== ISSUE #54 FOUND ===');
        console.log(`Status: ${issue54.status}`);
        console.log(`Title: ${issue54.title}`);
        console.log(`Created: ${issue54.created}`);
        console.log(`Last Updated: ${issue54.updated}`);
      } else {
        console.log('\n❌ Issue #54 NOT FOUND');
        console.log('\nAll issues:');
        issues.forEach(issue => {
          console.log(`#${issue.number}: ${issue.status} - ${issue.title.substring(0, 50)}...`);
        });
      }
    } else {
      console.log('No issues found in database');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

listAllIssues();