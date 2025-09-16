import { NextResponse } from 'next/server';
import { PutItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { getEnvironment, getTableName } from '../../../../lib/dynamodb';
import { db } from '../../../../lib/dynamodb';
import { validateUserSession } from '../../../../lib/auth-check';


export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const tableName = getTableName('Settings');
    const environment = getEnvironment();
    
    const command = new GetItemCommand({
      TableName: tableName,
      Key: {
        setting_key: { S: 'sa_mappings' }
      }
    });
    
    const result = await db.client.send(command);
    const settings = result.Item?.settings?.S ? JSON.parse(result.Item.settings.S) : {};
    
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error loading SA mapping settings:', error);
    
    // If table doesn't exist or schema mismatch, create it
    if (error.name === 'ResourceNotFoundException' || error.name === 'ValidationException') {
      try {
        const tableName = getTableName('Settings');
        await createSettingsTable(tableName);
      } catch (createError) {
        console.error('Error creating settings table:', createError);
      }
    }
    
    return NextResponse.json({ settings: {} });
  }
}

export async function POST(request) {
  let settings, tableName, environment;
  
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const requestData = await request.json();
    settings = requestData.settings;
    
    // Validate settings is an object to prevent code injection
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return NextResponse.json({ error: 'Invalid settings format' }, { status: 400 });
    }
    
    tableName = getTableName('Settings');
    environment = getEnvironment();
    
    const command = new PutItemCommand({
      TableName: tableName,
      Item: {
        setting_key: { S: 'sa_mappings' },
        settings: { S: JSON.stringify(settings) },
        environment: { S: environment },
        updated_at: { S: new Date().toISOString() }
      }
    });
    
    await db.client.send(command);
    
    // Send SSE notification for real-time updates
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/sse/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sa-mapping-settings-update'
        })
      });
    } catch (sseError) {
      console.error('SSE notification failed:', sseError);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving SA mapping settings:', error);
    
    // Check if table doesn't exist and try to create it
    if (error.name === 'ResourceNotFoundException' && tableName && settings) {
      try {
        await createSettingsTable(tableName);
        
        // Retry the save operation with recreated command
        const retryCommand = new PutItemCommand({
          TableName: tableName,
          Item: {
            setting_key: { S: 'sa_mappings' },
            settings: { S: JSON.stringify(settings) },
            environment: { S: environment },
            updated_at: { S: new Date().toISOString() }
          }
        });
        
        await db.client.send(retryCommand);
        return NextResponse.json({ success: true });
      } catch (createError) {
        console.error('Error creating settings table:', createError);
      }
    }
    
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}

async function createSettingsTable(tableName) {
  try {
    const { CreateTableCommand } = await import('@aws-sdk/client-dynamodb');
    const command = new CreateTableCommand({
      TableName: tableName,
      KeySchema: [{ AttributeName: 'setting_key', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'setting_key', AttributeType: 'S' }],
      BillingMode: 'PAY_PER_REQUEST'
    });
    await db.client.send(command);
    await new Promise(resolve => setTimeout(resolve, 10000));
    return true;
  } catch (error) {
    console.error('Error creating settings table:', error);
    return false;
  }
}