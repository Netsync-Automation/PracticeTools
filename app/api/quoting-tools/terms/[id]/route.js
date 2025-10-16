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
    const { months } = await request.json();
    
    if (!id || !months || isNaN(months) || months < 1) {
      return NextResponse.json({ error: 'ID and valid months are required' }, { status: 400 });
    }
    
    const tableName = getTableName('QuotingTerms');
    
    const command = new UpdateCommand({
      TableName: tableName,
      Key: { id },
      UpdateExpression: 'SET months = :months, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':months': parseInt(months),
        ':updatedAt': new Date().toISOString()
      }
    });
    
    await docClient.send(command);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Term PUT error:', error);
    return NextResponse.json({ error: 'Failed to update term' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }
    
    const tableName = getTableName('QuotingTerms');
    
    const command = new DeleteCommand({
      TableName: tableName,
      Key: { id }
    });
    
    await docClient.send(command);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Term DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete term' }, { status: 500 });
  }
}