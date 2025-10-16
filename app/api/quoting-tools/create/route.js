import { NextResponse } from 'next/server';
import { getTableName } from '../../../../lib/dynamodb';
import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

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
    
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      try {
        const describeCommand = new DescribeTableCommand({ TableName: tableName });
        const result = await client.send(describeCommand);
        
        if (result.Table.TableStatus === 'ACTIVE') {
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      }
    }
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      return;
    }
    throw error;
  }
}

export async function POST(request) {
  try {
    const { toolName, toolDescription, useWizard, createdBy, createdByName, practiceId, partNumbers, customerTypes, billingTypes, terms } = await request.json();
    
    if (!toolName?.trim() || !createdBy?.trim()) {
      return NextResponse.json({ error: 'Tool name and creator are required' }, { status: 400 });
    }
    
    const tableName = getTableName('QuotingTools');
    const id = uuidv4();
    const timestamp = new Date().toISOString();
    
    const item = {
      id,
      name: toolName.trim(),
      description: toolDescription?.trim() || '',
      useWizard: useWizard || false,
      practiceId: practiceId || '',
      createdBy: createdBy.trim(),
      createdByName: createdByName?.trim() || '',
      createdAt: timestamp,
      updatedAt: timestamp,
      partNumbers: partNumbers || [],
      customerTypes: customerTypes || [],
      billingTypes: billingTypes || [],
      terms: terms || []
    };
    
    await ensureTableExists(tableName);
    
    const command = new PutCommand({
      TableName: tableName,
      Item: item
    });
    
    await docClient.send(command);
    return NextResponse.json({ success: true, tool: item });
  } catch (error) {
    console.error('Create tool POST error:', error);
    return NextResponse.json({ error: 'Failed to create tool' }, { status: 500 });
  }
}