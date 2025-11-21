import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function fixDocumentStatus() {
  try {
    // Get all documents with pending/processing status
    const result = await docClient.send(new ScanCommand({
      TableName: 'PracticeTools-prod-Documentation',
      FilterExpression: 'extractionStatus = :status',
      ExpressionAttributeValues: {
        ':status': 'pending'
      }
    }));

    console.log(`Found ${result.Items.length} documents with pending status`);

    // Update each to completed
    for (const doc of result.Items) {
      await docClient.send(new UpdateCommand({
        TableName: 'PracticeTools-prod-Documentation',
        Key: { id: doc.id },
        UpdateExpression: 'SET extractionStatus = :status, processedAt = :processedAt',
        ExpressionAttributeValues: {
          ':status': 'completed',
          ':processedAt': new Date().toISOString()
        }
      }));
      console.log(`Updated document ${doc.id} to completed`);
    }

    console.log('All documents updated successfully');
  } catch (error) {
    console.error('Error:', error);
  }
}

fixDocumentStatus();