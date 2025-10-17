import { NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getTableName } from '../../../../lib/dynamodb';
import { createWebexLogsTable } from '../../../../lib/create-tables';

export const dynamic = 'force-dynamic';

const client = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    
    await createWebexLogsTable();
    const tableName = getTableName('webex_logs');
    const response = await docClient.send(new ScanCommand({
      TableName: tableName,
      Limit: limit
    }));
    
    const logs = (response.Items || []).sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Error fetching webhook logs:', error);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}