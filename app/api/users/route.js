import { NextResponse } from 'next/server';
import { getTableName } from '../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { db } from '../../../lib/dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

export async function GET() {
  try {
    console.log('🔍 [USERS-API] Starting user fetch...');
    console.log('🔍 [USERS-API] Environment:', process.env.NODE_ENV, process.env.ENVIRONMENT);
    
    const tableName = getTableName('Users');
    console.log('🔍 [USERS-API] Table name:', tableName);
    
    const command = new ScanCommand({
      TableName: tableName,
      ProjectionExpression: 'email, #name, practices, #role, region',
      ExpressionAttributeNames: {
        '#name': 'name',
        '#role': 'role'
      }
    });

    console.log('🔍 [USERS-API] Sending DynamoDB command...');
    const result = await docClient.send(command);
    console.log('🔍 [USERS-API] DynamoDB result:', { itemCount: result.Items?.length || 0 });
    
    const users = (result.Items || []).map(user => ({
      ...user,
      region: user.region || null
    }));

    console.log('🔍 [USERS-API] Returning users:', users.length);
    return NextResponse.json({ users });
  } catch (error) {
    console.error('❌ [USERS-API] Error loading users:', error);
    console.error('❌ [USERS-API] Error stack:', error.stack);
    console.error('❌ [USERS-API] Error details:', {
      name: error.name,
      message: error.message,
      code: error.code
    });
    return NextResponse.json({ error: 'Failed to load users', details: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { name, email, role, region, authMethod, password, practices } = await request.json();
    
    // Validate required fields
    if (!name || !email || !role) {
      return NextResponse.json({ error: 'Name, email, and role are required' }, { status: 400 });
    }
    
    // Validate password for local auth
    if (authMethod === 'local' && !password) {
      return NextResponse.json({ error: 'Password is required for local authentication' }, { status: 400 });
    }
    
    // Check if user already exists
    const existingUser = await db.getUser(email);
    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
    }
    
    // Determine auth method and source
    const finalAuthMethod = authMethod || (password ? 'local' : (role === 'account_manager' ? 'sso' : 'saml'));
    const source = role === 'account_manager' ? 'Local' : 'manual';
    
    console.log('[USER-CREATION-DEBUG] Auth method determination:', {
      providedAuthMethod: authMethod,
      hasPassword: !!password,
      role: role,
      finalAuthMethod: finalAuthMethod
    });
    
    const success = await db.createOrUpdateUser(
      email,
      name,
      finalAuthMethod,
      role,
      password,
      source,
      false,
      false,
      practices || [],
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