import { NextResponse } from 'next/server';
import { getTableName } from '../../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const tableName = getTableName('WebexMessages');
    
    const command = new GetCommand({
      TableName: tableName,
      Key: { message_id: id }
    });
    
    const result = await docClient.send(command);
    
    if (!result.Item) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }
    
    return NextResponse.json({ message: result.Item });
  } catch (error) {
    console.error('Error fetching message:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
