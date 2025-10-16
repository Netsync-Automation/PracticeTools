import { NextResponse } from 'next/server';
import { getTableName } from '../../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

export const dynamic = 'force-dynamic';

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const { name } = await request.json();
    
    if (!id || !name?.trim()) {
      return NextResponse.json({ error: 'ID and name are required' }, { status: 400 });
    }
    
    const tableName = getTableName('QuotingCustomerTypes');
    
    const command = new UpdateCommand({
      TableName: tableName,
      Key: { id },
      UpdateExpression: 'SET #name = :name, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#name': 'name' },
      ExpressionAttributeValues: {
        ':name': name.trim(),
        ':updatedAt': new Date().toISOString()
      }
    });
    
    await docClient.send(command);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Customer type PUT error:', error);
    return NextResponse.json({ error: 'Failed to update customer type' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }
    
    const tableName = getTableName('QuotingCustomerTypes');
    
    const command = new DeleteCommand({
      TableName: tableName,
      Key: { id }
    });
    
    await docClient.send(command);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Customer type DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete customer type' }, { status: 500 });
  }
}