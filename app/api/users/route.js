import { NextResponse } from 'next/server';
import { getTableName } from '../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { db } from '../../../lib/dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

export async function GET() {
  try {
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
    console.error('Error loading users:', error);
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { name, email, role, region } = await request.json();
    
    // Validate required fields
    if (!name || !email || !role) {
      return NextResponse.json({ error: 'Name, email, and role are required' }, { status: 400 });
    }
    
    // Check if user already exists
    const existingUser = await db.getUser(email);
    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
    }
    
    // Create new user with DSR-compliant settings for account managers
    const authMethod = role === 'account_manager' ? 'sso' : 'saml';
    const source = role === 'account_manager' ? 'Local' : 'manual';
    
    const success = await db.createOrUpdateUser(
      email,
      name,
      authMethod,
      role,
      null,
      source,
      false,
      false,
      [],
      'active',
      null,
      region
    );
    
    if (success) {
      return NextResponse.json({ success: true, message: 'User created successfully' });
    } else {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}