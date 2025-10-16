import { NextResponse } from 'next/server';
import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { getTableName } from '../../../../lib/dynamodb';

export const dynamic = 'force-dynamic';

const client = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

async function ensureTableExists(tableName) {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      await client.send(new CreateTableCommand({
        TableName: tableName,
        KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
        AttributeDefinitions: [{ AttributeName: 'email', AttributeType: 'S' }],
        BillingMode: 'PAY_PER_REQUEST'
      }));
    }
  }
}



export async function GET() {
  try {
    const tableName = getTableName('webex_hosts');
    await ensureTableExists(tableName);
    
    const command = new ScanCommand({
      TableName: tableName
    });
    
    const response = await docClient.send(command);
    const hosts = response.Items || [];
    
    return NextResponse.json({ hosts });
  } catch (error) {
    console.error('Error loading Webex hosts:', error);
    return NextResponse.json({ error: 'Failed to load hosts' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { email } = await request.json();
    
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }
    
    const tableName = getTableName('webex_hosts');
    await ensureTableExists(tableName);
    
    const putCommand = new PutCommand({
      TableName: tableName,
      Item: {
        email,
        addedAt: new Date().toISOString()
      },
      ConditionExpression: 'attribute_not_exists(email)'
    });
    
    await docClient.send(putCommand);
    
    // Return updated list
    const scanCommand = new ScanCommand({ TableName: tableName });
    const response = await docClient.send(scanCommand);
    
    return NextResponse.json({ hosts: response.Items || [] });
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      return NextResponse.json({ error: 'Host already exists' }, { status: 400 });
    }
    console.error('Error adding Webex host:', error);
    return NextResponse.json({ error: 'Failed to add host' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { email } = await request.json();
    
    const tableName = getTableName('webex_hosts');
    await ensureTableExists(tableName);
    
    const deleteCommand = new DeleteCommand({
      TableName: tableName,
      Key: { email }
    });
    
    await docClient.send(deleteCommand);
    
    // Return updated list
    const scanCommand = new ScanCommand({ TableName: tableName });
    const response = await docClient.send(scanCommand);
    
    return NextResponse.json({ hosts: response.Items || [] });
  } catch (error) {
    console.error('Error removing Webex host:', error);
    return NextResponse.json({ error: 'Failed to remove host' }, { status: 500 });
  }
}