import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const client = new DynamoDBClient({
  region: process.env.AWS_DEFAULT_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function querySaAssignment() {
  try {
    const command = new ScanCommand({
      TableName: 'PracticeTools-dev-sa-assignments',
      FilterExpression: 'sa_assignment_number = :num',
      ExpressionAttributeValues: {
        ':num': { N: '33' }
      }
    });

    const result = await client.send(command);
    
    if (result.Items && result.Items.length > 0) {
      console.log('SA Assignment #33 Record:');
      console.log(JSON.stringify(result.Items[0], null, 2));
    } else {
      console.log('No SA Assignment found with number 33');
    }
  } catch (error) {
    console.error('Error querying DynamoDB:', error);
  }
}

querySaAssignment();