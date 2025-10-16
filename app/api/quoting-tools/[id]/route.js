import { NextResponse } from 'next/server';
import { getTableName } from '../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    const tableName = getTableName('QuotingTools');
    
    const command = new DeleteCommand({
      TableName: tableName,
      Key: { id }
    });
    
    await docClient.send(command);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete tool error:', error);
    return NextResponse.json({ error: 'Failed to delete tool' }, { status: 500 });
  }
}