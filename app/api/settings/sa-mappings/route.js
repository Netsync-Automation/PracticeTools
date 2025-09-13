import { NextResponse } from 'next/server';
import { PutItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { getEnvironment, getTableName } from '../../../../lib/dynamodb';
import { db } from '../../../../lib/dynamodb';

export async function GET() {
  try {
    const tableName = getTableName('Settings');
    const environment = getEnvironment();
    
    const command = new GetItemCommand({
      TableName: tableName,
      Key: {
        id: { S: `${environment}_sa_mappings` }
      }
    });
    
    const result = await db.client.send(command);
    const settings = result.Item?.settings?.S ? JSON.parse(result.Item.settings.S) : {};
    
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error loading SA mapping settings:', error);
    return NextResponse.json({ settings: {} });
  }
}

export async function POST(request) {
  try {
    const { settings } = await request.json();
    const tableName = getTableName('Settings');
    const environment = getEnvironment();
    
    const command = new PutItemCommand({
      TableName: tableName,
      Item: {
        id: { S: `${environment}_sa_mappings` },
        setting_key: { S: 'sa_mappings' },
        settings: { S: JSON.stringify(settings) },
        environment: { S: environment },
        updated_at: { S: new Date().toISOString() }
      }
    });
    
    await db.client.send(command);
    
    // Send SSE notification for real-time updates
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/sse/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'sa-mapping-settings-update'
      })
    }).catch(() => {}); // Silent fail for SSE
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving SA mapping settings:', error);
    
    // Check if table doesn't exist and try to create it
    if (error.name === 'ResourceNotFoundException') {
      try {
        await createSettingsTable(tableName);
        // Retry the save operation
        await db.client.send(command);
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
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
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