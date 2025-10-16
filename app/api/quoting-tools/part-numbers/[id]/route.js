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
    const { partNumber, description, listPrice, cost, partType, customerType } = await request.json();
    
    if (!id || !partNumber?.trim() || !description?.trim() || !listPrice?.trim() || !cost?.trim() || !customerType?.trim()) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }
    
    const tableName = getTableName('QuotingPartNumbers');
    
    const command = new UpdateCommand({
      TableName: tableName,
      Key: { id },
      UpdateExpression: 'SET partNumber = :partNumber, description = :description, listPrice = :listPrice, cost = :cost, partType = :partType, customerType = :customerType, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':partNumber': partNumber.trim(),
        ':description': description.trim(),
        ':listPrice': listPrice.trim(),
        ':cost': cost.trim(),
        ':partType': partType || 'HW/SW',
        ':customerType': customerType.trim(),
        ':updatedAt': new Date().toISOString()
      }
    });
    
    await docClient.send(command);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Part number PUT error:', error);
    return NextResponse.json({ error: 'Failed to update part number' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }
    
    const tableName = getTableName('QuotingPartNumbers');
    
    const command = new DeleteCommand({
      TableName: tableName,
      Key: { id }
    });
    
    await docClient.send(command);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Part number DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete part number' }, { status: 500 });
  }
}