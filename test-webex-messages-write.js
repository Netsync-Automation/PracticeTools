import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function testWrite() {
  try {
    const testData = {
      message_id: `test-${uuidv4()}`,
      room_id: 'test-room',
      site_url: 'test.webex.com',
      person_email: 'test@example.com',
      person_id: 'test-person',
      text: 'Test message',
      html: '<p>Test message</p>',
      created: new Date().toISOString(),
      attachments: [],
      timestamp: new Date().toISOString()
    };

    console.log('Writing test data to PracticeTools-dev-WebexMessages...');
    await docClient.send(new PutCommand({
      TableName: 'PracticeTools-dev-WebexMessages',
      Item: testData
    }));
    
    console.log('✓ Write successful!');
    console.log('Test data:', testData);
  } catch (error) {
    console.error('✗ Write failed:', error.message);
    console.error('Error name:', error.name);
    console.error('Full error:', error);
  }
}

testWrite();
