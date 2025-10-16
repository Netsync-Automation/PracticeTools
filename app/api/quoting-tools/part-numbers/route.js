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
    console.log(`Table ${tableName} created, waiting for it to be active...`);
    
    // Wait for table to be active
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      try {
        const describeCommand = new DescribeTableCommand({ TableName: tableName });
        const result = await client.send(describeCommand);
        
        if (result.Table.TableStatus === 'ACTIVE') {
          console.log(`Table ${tableName} is now active`);
          return;
        }
        
        console.log(`Table ${tableName} status: ${result.Table.TableStatus}, waiting...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      } catch (error) {
        console.log(`Attempt ${attempts + 1} to check table status failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      }
    }
    
    throw new Error(`Table ${tableName} did not become active within timeout`);
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log(`Table ${tableName} already exists`);
      return;
    }
    console.error(`Error creating table ${tableName}:`, error);
    throw error;
  }
}

export async function POST(request) {
  try {
    const { partNumber, description, listPrice, cost, partType, customerType, createdBy, createdByName } = await request.json();
    
    if (!partNumber?.trim() || !description?.trim() || !listPrice?.trim() || !cost?.trim() || !customerType?.trim()) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }
    
    const tableName = getTableName('QuotingPartNumbers');
    const id = uuidv4();
    const timestamp = new Date().toISOString();
    
    const item = {
      id,
      partNumber: partNumber.trim(),
      description: description.trim(),
      listPrice: listPrice.trim(),
      cost: cost.trim(),
      partType: partType || 'HW/SW',
      customerType: customerType.trim(),
      createdBy: createdBy || '',
      createdByName: createdByName || '',
      createdAt: timestamp,
      updatedAt: timestamp
    };
    
    try {
      const command = new PutCommand({
        TableName: tableName,
        Item: item
      });
      
      await docClient.send(command);
      return NextResponse.json({ success: true, partNumber: item });
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await ensureTableExists(tableName);
        
        const retryCommand = new PutCommand({
          TableName: tableName,
          Item: item
        });
        
        await docClient.send(retryCommand);
        return NextResponse.json({ success: true, partNumber: item });
      }
      throw error;
    }
  } catch (error) {
    console.error('Part numbers POST error:', error);
    return NextResponse.json({ error: 'Failed to save part number' }, { status: 500 });
  }
}