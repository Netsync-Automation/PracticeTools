import { NextResponse } from 'next/server';
import { PutItemCommand, ScanCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { getEnvironment, getTableName } from '../../../lib/dynamodb';
import { db } from '../../../lib/dynamodb';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const practiceGroupId = searchParams.get('practiceGroupId');
    const all = searchParams.get('all');
    
    if (!practiceGroupId && !all) {
      return NextResponse.json({ success: true, mappings: [] });
    }

    const tableName = getTableName('SAToAMMappings');
    
    let command;
    if (all === 'true') {
      // Get all mappings
      command = new ScanCommand({
        TableName: tableName
      });
    } else {
      // Get mappings for specific practice group
      command = new ScanCommand({
        TableName: tableName,
        FilterExpression: 'practice_group_id = :practiceGroupId',
        ExpressionAttributeValues: {
          ':practiceGroupId': { S: practiceGroupId }
        }
      });
    }
    
    const result = await db.client.send(command);
    const mappings = (result.Items || []).map(item => ({
      id: item.id?.S || '',
      saName: item.sa_name?.S || '',
      amName: item.am_name?.S || '',
      amEmail: item.am_email?.S || '',
      region: item.region?.S || '',
      practiceGroupId: item.practice_group_id?.S || '',
      practices: JSON.parse(item.practices?.S || '[]'),
      isAllMapping: item.is_all_mapping?.BOOL || false,
      createdAt: item.created_at?.S || ''
    }));
    
    return NextResponse.json({
      success: true,
      mappings: mappings
    });
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      await createSAToAMMappingsTable(getTableName('SAToAMMappings'));
      return NextResponse.json({ success: true, mappings: [] });
    }
    console.error('Error fetching SA to AM mappings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch SA to AM mappings' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const environment = getEnvironment();
    const tableName = getTableName('SAToAMMappings');
    
    // Handle "All" option - create mappings for all existing AMs
    if (data.amName === 'All') {
      const accountManagers = await db.getAllUsers();
      const ams = accountManagers.filter(user => user.role === 'account_manager');
      
      // Get existing mappings to check for duplicates
      const existingCommand = new (await import('@aws-sdk/client-dynamodb')).ScanCommand({
        TableName: tableName
      });
      const existingResult = await db.client.send(existingCommand);
      const existingMappings = (existingResult.Items || []).map(item => ({
        saName: item.sa_name?.S || '',
        amEmail: item.am_email?.S || '',
        practices: JSON.parse(item.practices?.S || '[]')
      }));
      
      const createdMappings = [];
      const timestamp = new Date().toISOString();
      
      for (const am of ams) {
        // Check for duplicate
        const isDuplicate = existingMappings.some(existing => 
          existing.saName === data.saName &&
          existing.amEmail === am.email &&
          JSON.stringify(existing.practices) === JSON.stringify(data.practices)
        );
        
        if (isDuplicate) {
          console.log('Skipping duplicate mapping', { saName: data.saName, amEmail: am.email });
          continue;
        }
        
        const mappingId = uuidv4();
        const command = new PutItemCommand({
          TableName: tableName,
          Item: {
            id: { S: mappingId },
            sa_name: { S: data.saName },
            am_name: { S: am.name },
            am_email: { S: am.email },
            region: { S: am.region || '' },
            practice_group_id: { S: data.practiceGroupId },
            practices: { S: JSON.stringify(data.practices || []) },
            is_all_mapping: { BOOL: true }, // Flag to identify "All" mappings
            created_at: { S: timestamp },
            environment: { S: environment }
          }
        });
        
        await db.client.send(command);
        createdMappings.push({ id: mappingId, amName: am.name });
      }
      
      console.log('Created "All" SA to AM mappings:', {
        saName: data.saName,
        practiceGroupId: data.practiceGroupId,
        practices: data.practices,
        mappingCount: createdMappings.length
      });
      
      // Send SSE notification
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/sse/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sa-to-am-mapping-update',
          practiceGroupId: data.practiceGroupId
        })
      });
      
      return NextResponse.json({
        success: true,
        message: `SA to AM mappings created for ${createdMappings.length} account managers`
      });
    }
    
    // Regular single mapping creation
    const id = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Get AM email from account managers list
    const accountManagers = await db.getAllUsers();
    const amUser = accountManagers.find(user => user.role === 'account_manager' && user.name === data.amName);
    
    // Check for duplicate mapping
    const existingCommand = new (await import('@aws-sdk/client-dynamodb')).ScanCommand({
      TableName: tableName,
      FilterExpression: 'sa_name = :saName AND am_email = :amEmail AND practices = :practices',
      ExpressionAttributeValues: {
        ':saName': { S: data.saName },
        ':amEmail': { S: amUser?.email || '' },
        ':practices': { S: JSON.stringify(data.practices || []) }
      }
    });
    
    const existingResult = await db.client.send(existingCommand);
    if (existingResult.Items && existingResult.Items.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Mapping already exists for this SA-AM-Practice combination' },
        { status: 409 }
      );
    }
    
    const command = new PutItemCommand({
      TableName: tableName,
      Item: {
        id: { S: id },
        sa_name: { S: data.saName },
        am_name: { S: data.amName },
        am_email: { S: amUser?.email || '' },
        region: { S: data.region },
        practice_group_id: { S: data.practiceGroupId },
        practices: { S: JSON.stringify(data.practices || []) },
        created_at: { S: timestamp },
        environment: { S: environment }
      }
    });
    
    await db.client.send(command);
    
    console.log('Created SA to AM mapping:', {
      id,
      ...data,
      environment,
      tableName
    });
    
    // Send SSE notification
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/sse/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'sa-to-am-mapping-update',
        practiceGroupId: data.practiceGroupId
      })
    });
    
    return NextResponse.json({
      success: true,
      message: 'SA to AM mapping created successfully'
    });
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      await createSAToAMMappingsTable(getTableName('SAToAMMappings'));
      // Retry the request
      return POST(request);
    }
    console.error('Error creating SA to AM mapping:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create SA to AM mapping' },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const data = await request.json();
    const environment = getEnvironment();
    const tableName = getTableName('SAToAMMappings');
    
    if (!data.id) {
      return NextResponse.json(
        { success: false, error: 'Mapping ID is required' },
        { status: 400 }
      );
    }
    
    // Handle "All" option for updates
    if (data.amName === 'All') {
      // Delete existing mapping
      const deleteCommand = new DeleteItemCommand({
        TableName: tableName,
        Key: { id: { S: data.id } }
      });
      await db.client.send(deleteCommand);
      
      // Create new mappings for all AMs
      const accountManagers = await db.getAllUsers();
      const ams = accountManagers.filter(user => user.role === 'account_manager');
      
      const createdMappings = [];
      const timestamp = new Date().toISOString();
      
      // Get existing mappings to check for duplicates
      const existingCommand = new (await import('@aws-sdk/client-dynamodb')).ScanCommand({
        TableName: tableName
      });
      const existingResult = await db.client.send(existingCommand);
      const existingMappings = (existingResult.Items || []).map(item => ({
        saName: item.sa_name?.S || '',
        amEmail: item.am_email?.S || '',
        practices: JSON.parse(item.practices?.S || '[]')
      }));
      
      for (const am of ams) {
        // Check for duplicate
        const isDuplicate = existingMappings.some(existing => 
          existing.saName === data.saName &&
          existing.amEmail === am.email &&
          JSON.stringify(existing.practices) === JSON.stringify(data.practices)
        );
        
        if (isDuplicate) {
          console.log('Skipping duplicate mapping in PUT', { saName: data.saName, amEmail: am.email });
          continue;
        }
        
        const mappingId = uuidv4();
        const command = new PutItemCommand({
          TableName: tableName,
          Item: {
            id: { S: mappingId },
            sa_name: { S: data.saName },
            am_name: { S: am.name },
            am_email: { S: am.email },
            region: { S: am.region || '' },
            practice_group_id: { S: data.practiceGroupId },
            practices: { S: JSON.stringify(data.practices || []) },
            is_all_mapping: { BOOL: true },
            created_at: { S: timestamp },
            environment: { S: environment }
          }
        });
        
        await db.client.send(command);
        createdMappings.push({ id: mappingId, amName: am.name });
      }
      
      // Send SSE notification
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/sse/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sa-to-am-mapping-update',
          practiceGroupId: data.practiceGroupId
        })
      });
      
      return NextResponse.json({
        success: true,
        message: `SA to AM mappings updated for ${createdMappings.length} account managers`
      });
    }
    
    // Get AM email from account managers list
    const accountManagers = await db.getAllUsers();
    const amUser = accountManagers.find(user => user.role === 'account_manager' && user.name === data.amName);
    
    // Regular single mapping update
    const command = new PutItemCommand({
      TableName: tableName,
      Item: {
        id: { S: data.id },
        sa_name: { S: data.saName },
        am_name: { S: data.amName },
        am_email: { S: amUser?.email || '' },
        region: { S: data.region },
        practice_group_id: { S: data.practiceGroupId },
        practices: { S: JSON.stringify(data.practices || []) },
        created_at: { S: new Date().toISOString() },
        environment: { S: environment }
      }
    });
    
    await db.client.send(command);
    
    console.log('Updated SA to AM mapping:', {
      id: data.id,
      ...data,
      environment,
      tableName
    });
    
    // Send SSE notification
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/sse/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'sa-to-am-mapping-update',
        practiceGroupId: data.practiceGroupId
      })
    });
    
    return NextResponse.json({
      success: true,
      message: 'SA to AM mapping updated successfully'
    });
  } catch (error) {
    console.error('Error updating SA to AM mapping:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update SA to AM mapping' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const practiceGroupId = searchParams.get('practiceGroupId');
    const environment = getEnvironment();
    const tableName = getTableName('SAToAMMappings');
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Mapping ID is required' },
        { status: 400 }
      );
    }
    
    const command = new DeleteItemCommand({
      TableName: tableName,
      Key: {
        id: { S: id }
      }
    });
    
    await db.client.send(command);
    
    console.log('Deleted SA to AM mapping:', {
      id,
      environment,
      tableName
    });
    
    // Send SSE notification
    if (practiceGroupId) {
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/sse/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sa-to-am-mapping-update',
          practiceGroupId: practiceGroupId
        })
      });
    }
    
    return NextResponse.json({
      success: true,
      message: 'SA to AM mapping deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting SA to AM mapping:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete SA to AM mapping' },
      { status: 500 }
    );
  }
}

async function createSAToAMMappingsTable(tableName) {
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
    console.log('SA to AM Mappings table created successfully');
    return true;
  } catch (error) {
    console.error('Error creating SA to AM Mappings table:', error);
    return false;
  }
}