import { DynamoDBClient, UpdateItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

const ENV = process.env.ENVIRONMENT || 'prod';
const RELEASES_TABLE = `PracticeTools-${ENV}-Releases`;

const client = new DynamoDBClient({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
  credentials: fromNodeProviderChain({
    timeout: 5000,
    maxRetries: 3,
  }),
});

export async function POST(request) {
  // Verify admin API key
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  if (token !== process.env.ADMIN_API_KEY) {
    return Response.json({ error: 'Invalid API key' }, { status: 401 });
  }

  const { originalVersion, correctVersion, reason } = await request.json();

  if (!originalVersion || !correctVersion) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    // Get existing release notes
    const getCommand = new GetItemCommand({
      TableName: RELEASES_TABLE,
      Key: {
        version: { S: originalVersion }
      }
    });

    const existingItem = await client.send(getCommand);
    
    if (!existingItem.Item) {
      return Response.json({ error: 'Original version not found' }, { status: 404 });
    }

    // Update with corrected version and add reversion note
    const originalNotes = existingItem.Item.notes?.S || '';
    const reversionNote = `\n\n---\n\n**📝 Version Correction Notice:**\nThis release was originally versioned as ${originalVersion} but has been corrected to ${correctVersion} based on intelligent code analysis.\n\n**Reason:** ${reason}\n\n**Original Release Notes:**\n${originalNotes}`;

    const updateCommand = new UpdateItemCommand({
      TableName: RELEASES_TABLE,
      Key: {
        version: { S: originalVersion }
      },
      UpdateExpression: 'SET corrected_version = :cv, reversion_reason = :rr, notes = :notes, updated_at = :ua',
      ExpressionAttributeValues: {
        ':cv': { S: correctVersion },
        ':rr': { S: reason },
        ':notes': { S: reversionNote },
        ':ua': { S: new Date().toISOString() }
      }
    });

    await client.send(updateCommand);

    return Response.json({ 
      success: true, 
      message: `Version ${originalVersion} corrected to ${correctVersion}` 
    });
  } catch (error) {
    console.error('Database error:', error);
    return Response.json({ error: 'Database operation failed' }, { status: 500 });
  }
}