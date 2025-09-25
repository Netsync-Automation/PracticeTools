import { NextResponse } from 'next/server';
import { getTableName } from '../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { validateUserSession } from '../../../../lib/auth-check';

const client = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

export async function GET(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = validation.user;
    
    // Allow all authenticated users to lookup users for assignment purposes
    // This includes practice members who need to assign users to cards
    const tableName = getTableName('Users');
    
    const command = new ScanCommand({
      TableName: tableName,
      ProjectionExpression: 'email, #name, practices, #role, region',
      ExpressionAttributeNames: {
        '#name': 'name',
        '#role': 'role'
      }
    });

    const result = await docClient.send(command);
    const users = (result.Items || []).map(user => ({
      ...user,
      region: user.region || null
    }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error loading users for lookup:', error);
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 });
  }
}