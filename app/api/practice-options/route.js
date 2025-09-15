import { NextResponse } from 'next/server';
import { getTableName, getEnvironment } from '../../../lib/dynamodb';
import { DynamoDBClient, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

export const dynamic = 'force-dynamic';

async function ensureTableExists(tableName) {
  try {
    const createCommand = new CreateTableCommand({
      TableName: tableName,
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
      BillingMode: 'PAY_PER_REQUEST'
    });
    
    await client.send(createCommand);
    
    // Wait for table to be active
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (error) {
    if (error.name !== 'ResourceInUseException') {
      throw error;
    }
  }
}

export async function GET() {
  try {
    const tableName = getTableName('PracticeOptions');
    
    try {
      const command = new ScanCommand({ TableName: tableName });
      const result = await docClient.send(command);
      const practices = result.Items?.map(item => item.name).sort() || [];
      return NextResponse.json({ practices });
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await ensureTableExists(tableName);
        return NextResponse.json({ practices: [] });
      }
      throw error;
    }
  } catch (error) {
    console.error('Practice options GET error:', error);
    return NextResponse.json({ error: `Failed to fetch practice options: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { name } = await request.json();
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Practice name is required' }, { status: 400 });
    }
    
    const tableName = getTableName('PracticeOptions');
    
    try {
      const command = new PutCommand({
        TableName: tableName,
        Item: {
          id: name.trim(),
          name: name.trim(),
          created_at: new Date().toISOString()
        }
      });
      
      await docClient.send(command);
      return NextResponse.json({ success: true });
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await ensureTableExists(tableName);
        
        // Retry the put operation
        const command = new PutCommand({
          TableName: tableName,
          Item: {
            id: name.trim(),
            name: name.trim(),
            created_at: new Date().toISOString()
          }
        });
        
        await docClient.send(command);
        return NextResponse.json({ success: true });
      }
      throw error;
    }
  } catch (error) {
    console.error('Practice options POST error:', error);
    return NextResponse.json({ error: `Failed to save practice option: ${error.message}` }, { status: 500 });
  }
}