import { NextResponse } from 'next/server';
import { PutItemCommand, ScanCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { getEnvironment, getTableName } from '../../../lib/dynamodb';
import { db } from '../../../lib/dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { validateUserSession } from '../../../lib/auth-check';


export const dynamic = 'force-dynamic';
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
      // Get all active mappings
      command = new ScanCommand({
        TableName: tableName,
        FilterExpression: 'attribute_not_exists(is_deleted) OR is_deleted = :false',
        ExpressionAttributeValues: {
          ':false': { BOOL: false }
        }
      });
    } else {
      // Get active mappings for specific practice group
      command = new ScanCommand({
        TableName: tableName,
        FilterExpression: 'practice_group_id = :practiceGroupId AND (attribute_not_exists(is_deleted) OR is_deleted = :false)',
        ExpressionAttributeValues: {
          ':practiceGroupId': { S: practiceGroupId },
          ':false': { BOOL: false }
        }
      });
    }
    
    const result = await db.client.send(command);
    const mappings = (result.Items || []).map(item => {
      const history = JSON.parse(item.history?.S || '[]');
      const lastHistoryEntry = history.length > 0 ? history[history.length - 1] : null;
      
      return {
        id: item.id?.S || '',
        saName: item.sa_name?.S || '',
        saEmail: item.sa_email?.S || '',
        amName: item.am_name?.S || '',
        amEmail: item.am_email?.S || '',
        region: item.region?.S || '',
        practiceGroupId: item.practice_group_id?.S || '',
        practices: JSON.parse(item.practices?.S || '[]'),
        isAllMapping: item.is_all_mapping?.BOOL || false,
        created_at: item.created_at?.S || '',
        updated_at: item.updated_at?.S || item.created_at?.S || '',
        created_by: history.find(entry => entry.action === 'created')?.user || 'Unknown',
        updated_by: lastHistoryEntry?.user || history.find(entry => entry.action === 'created')?.user || 'Unknown',
        history: history
      };
    });
    
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
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const data = await request.json();
    const environment = getEnvironment();
    const tableName = getTableName('SAToAMMappings');
    const user = validation.user;
    const timestamp = new Date().toISOString();
    
    const allUsers = await db.getAllUsers();
    
    // Helper function to create mapping signature for matching
    const createMappingSignature = (saName, amEmail, practices, region) => {
      return `${saName}|${amEmail}|${JSON.stringify(practices.sort())}|${region}`;
    };
    
    // Helper function to add history entry with changes
    const addHistoryEntry = (existingHistory, action, user, timestamp, changes = null, reason = null) => {
      const newEntry = {
        action,
        user: user.name || user.email,
        userEmail: user.email,
        timestamp,
        ...(changes && { changes }),
        ...(reason && { reason })
      };
      return [...(existingHistory || []), newEntry];
    };
    
    // Handle "All" option - create mappings for all existing AMs
    if (data.amName === 'All') {
      const ams = allUsers.filter(user => user.role === 'account_manager');
      const saUser = allUsers.find(user => user.name === data.saName);
      const saEmail = saUser?.email || '';
      
      const createdMappings = [];
      
      for (const am of ams) {
        const mappingSignature = createMappingSignature(data.saName, am.email, data.practices, am.region || '');
        
        // Check for existing deleted mapping to reinstate
        const deletedCommand = new ScanCommand({
          TableName: tableName,
          FilterExpression: 'mapping_signature = :signature AND is_deleted = :true',
          ExpressionAttributeValues: {
            ':signature': { S: mappingSignature },
            ':true': { BOOL: true }
          }
        });
        
        const deletedResult = await db.client.send(deletedCommand);
        
        if (deletedResult.Items && deletedResult.Items.length > 0) {
          // Reinstate deleted mapping
          const deletedMapping = deletedResult.Items[0];
          const existingHistory = JSON.parse(deletedMapping.history?.S || '[]');
          const updatedHistory = addHistoryEntry(existingHistory, 'reinstated', user, timestamp);
          
          const reinstateCommand = new PutItemCommand({
            TableName: tableName,
            Item: {
              ...deletedMapping,
              is_deleted: { BOOL: false },
              history: { S: JSON.stringify(updatedHistory) },
              updated_at: { S: timestamp }
            }
          });
          
          await db.client.send(reinstateCommand);
          createdMappings.push({ id: deletedMapping.id.S, amName: am.name, action: 'reinstated' });
        } else {
          // Check for active duplicate
          const activeCommand = new ScanCommand({
            TableName: tableName,
            FilterExpression: 'mapping_signature = :signature AND (attribute_not_exists(is_deleted) OR is_deleted = :false)',
            ExpressionAttributeValues: {
              ':signature': { S: mappingSignature },
              ':false': { BOOL: false }
            }
          });
          
          const activeResult = await db.client.send(activeCommand);
          if (activeResult.Items && activeResult.Items.length > 0) {
            continue; // Skip duplicate
          }
          
          // Create new mapping
          const mappingId = uuidv4();
          const initialHistory = addHistoryEntry([], 'created', user, timestamp);
          
          const command = new PutItemCommand({
            TableName: tableName,
            Item: {
              id: { S: mappingId },
              sa_name: { S: data.saName },
              sa_email: { S: saEmail },
              am_name: { S: am.name },
              am_email: { S: am.email },
              region: { S: am.region || '' },
              practice_group_id: { S: data.practiceGroupId },
              practices: { S: JSON.stringify(data.practices || []) },
              mapping_signature: { S: mappingSignature },
              is_all_mapping: { BOOL: true },
              is_deleted: { BOOL: false },
              history: { S: JSON.stringify(initialHistory) },
              created_at: { S: timestamp },
              updated_at: { S: timestamp },
              environment: { S: environment }
            }
          });
          
          await db.client.send(command);
          createdMappings.push({ id: mappingId, amName: am.name, action: 'created' });
        }
      }
      
      // Send SSE notification
      try {
        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/sse/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'sa-to-am-mapping-update',
            practiceGroupId: data.practiceGroupId
          })
        });
      } catch (sseError) {
        console.error('SSE notification failed:', sseError);
      }
      
      return NextResponse.json({
        success: true,
        message: `SA to AM mappings processed for ${createdMappings.length} account managers`
      });
    }
    
    // Regular single mapping creation
    const amUser = allUsers.find(user => user.role === 'account_manager' && user.name === data.amName);
    const saUser = allUsers.find(user => user.name === data.saName);
    const saEmail = saUser?.email || '';
    const mappingSignature = createMappingSignature(data.saName, amUser?.email || '', data.practices, data.region);
    
    // Check for existing deleted mapping to reinstate
    const deletedCommand = new ScanCommand({
      TableName: tableName,
      FilterExpression: 'mapping_signature = :signature AND is_deleted = :true',
      ExpressionAttributeValues: {
        ':signature': { S: mappingSignature },
        ':true': { BOOL: true }
      }
    });
    
    const deletedResult = await db.client.send(deletedCommand);
    
    if (deletedResult.Items && deletedResult.Items.length > 0) {
      // Reinstate deleted mapping
      const deletedMapping = deletedResult.Items[0];
      const existingHistory = JSON.parse(deletedMapping.history?.S || '[]');
      const updatedHistory = addHistoryEntry(existingHistory, 'reinstated', user, timestamp);
      
      const reinstateCommand = new PutItemCommand({
        TableName: tableName,
        Item: {
          ...deletedMapping,
          is_deleted: { BOOL: false },
          history: { S: JSON.stringify(updatedHistory) },
          updated_at: { S: timestamp }
        }
      });
      
      await db.client.send(reinstateCommand);
      
      // Send SSE notification
      try {
        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/sse/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'sa-to-am-mapping-update',
            practiceGroupId: data.practiceGroupId
          })
        });
      } catch (sseError) {
        console.error('SSE notification failed:', sseError);
      }
      
      return NextResponse.json({
        success: true,
        message: 'SA to AM mapping reinstated successfully'
      });
    }
    
    // Check for active duplicate
    const activeCommand = new ScanCommand({
      TableName: tableName,
      FilterExpression: 'mapping_signature = :signature AND (attribute_not_exists(is_deleted) OR is_deleted = :false)',
      ExpressionAttributeValues: {
        ':signature': { S: mappingSignature },
        ':false': { BOOL: false }
      }
    });
    
    const activeResult = await db.client.send(activeCommand);
    if (activeResult.Items && activeResult.Items.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Mapping already exists for this SA-AM-Practice-Region combination' },
        { status: 409 }
      );
    }
    
    // Create new mapping
    const id = uuidv4();
    const initialHistory = addHistoryEntry([], 'created', user, timestamp);
    
    const command = new PutItemCommand({
      TableName: tableName,
      Item: {
        id: { S: id },
        sa_name: { S: data.saName },
        sa_email: { S: saEmail },
        am_name: { S: data.amName },
        am_email: { S: amUser?.email || '' },
        region: { S: data.region },
        practice_group_id: { S: data.practiceGroupId },
        practices: { S: JSON.stringify(data.practices || []) },
        mapping_signature: { S: mappingSignature },
        is_deleted: { BOOL: false },
        history: { S: JSON.stringify(initialHistory) },
        created_at: { S: timestamp },
        updated_at: { S: timestamp },
        environment: { S: environment }
      }
    });
    
    await db.client.send(command);
    
    // Send SSE notification
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/sse/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sa-to-am-mapping-update',
          practiceGroupId: data.practiceGroupId
        })
      });
    } catch (sseError) {
      console.error('SSE notification failed:', sseError);
    }
    
    return NextResponse.json({
      success: true,
      message: 'SA to AM mapping created successfully'
    });
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      await createSAToAMMappingsTable(getTableName('SAToAMMappings'));
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
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const data = await request.json();
    const environment = getEnvironment();
    const tableName = getTableName('SAToAMMappings');
    const user = validation.user;
    const timestamp = new Date().toISOString();
    
    if (!data.id) {
      return NextResponse.json(
        { success: false, error: 'Mapping ID is required' },
        { status: 400 }
      );
    }
    
    // Get existing mapping to preserve history
    const getCommand = new ScanCommand({
      TableName: tableName,
      FilterExpression: 'id = :id',
      ExpressionAttributeValues: {
        ':id': { S: data.id }
      }
    });
    
    const getResult = await db.client.send(getCommand);
    if (!getResult.Items || getResult.Items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Mapping not found' },
        { status: 404 }
      );
    }
    
    const existingMapping = getResult.Items[0];
    const existingHistory = JSON.parse(existingMapping.history?.S || '[]');
    
    // Helper function to add history entry
    const addHistoryEntry = (existingHistory, action, user, timestamp) => {
      const newEntry = {
        action,
        user: user.name || user.email,
        userEmail: user.email,
        timestamp
      };
      return [...(existingHistory || []), newEntry];
    };
    
    // Handle "All" option for updates
    if (data.amName === 'All') {
      // Soft delete existing mapping
      const deleteHistory = addHistoryEntry(existingHistory, 'deleted', user, timestamp);
      const softDeleteCommand = new PutItemCommand({
        TableName: tableName,
        Item: {
          ...existingMapping,
          is_deleted: { BOOL: true },
          history: { S: JSON.stringify(deleteHistory) },
          updated_at: { S: timestamp }
        }
      });
      await db.client.send(softDeleteCommand);
      
      // Create new mappings for all AMs (using POST logic)
      const allUsers = await db.getAllUsers();
      const ams = allUsers.filter(user => user.role === 'account_manager');
      const saUser = allUsers.find(user => user.name === data.saName);
      const saEmail = saUser?.email || '';
      
      const createdMappings = [];
      
      for (const am of ams) {
        const mappingSignature = `${data.saName}|${am.email}|${JSON.stringify(data.practices.sort())}|${am.region || ''}`;
        
        // Check for existing deleted mapping to reinstate
        const deletedCommand = new ScanCommand({
          TableName: tableName,
          FilterExpression: 'mapping_signature = :signature AND is_deleted = :true',
          ExpressionAttributeValues: {
            ':signature': { S: mappingSignature },
            ':true': { BOOL: true }
          }
        });
        
        const deletedResult = await db.client.send(deletedCommand);
        
        if (deletedResult.Items && deletedResult.Items.length > 0) {
          // Reinstate deleted mapping
          const deletedMapping = deletedResult.Items[0];
          const deletedHistory = JSON.parse(deletedMapping.history?.S || '[]');
          const reinstateHistory = addHistoryEntry(deletedHistory, 'reinstated', user, timestamp);
          
          const reinstateCommand = new PutItemCommand({
            TableName: tableName,
            Item: {
              ...deletedMapping,
              is_deleted: { BOOL: false },
              history: { S: JSON.stringify(reinstateHistory) },
              updated_at: { S: timestamp }
            }
          });
          
          await db.client.send(reinstateCommand);
          createdMappings.push({ id: deletedMapping.id.S, amName: am.name, action: 'reinstated' });
        } else {
          // Create new mapping
          const mappingId = uuidv4();
          const createHistory = addHistoryEntry([], 'created', user, timestamp);
          
          const command = new PutItemCommand({
            TableName: tableName,
            Item: {
              id: { S: mappingId },
              sa_name: { S: data.saName },
              sa_email: { S: saEmail },
              am_name: { S: am.name },
              am_email: { S: am.email },
              region: { S: am.region || '' },
              practice_group_id: { S: data.practiceGroupId },
              practices: { S: JSON.stringify(data.practices || []) },
              mapping_signature: { S: mappingSignature },
              is_all_mapping: { BOOL: true },
              is_deleted: { BOOL: false },
              history: { S: JSON.stringify(createHistory) },
              created_at: { S: timestamp },
              updated_at: { S: timestamp },
              environment: { S: environment }
            }
          });
          
          await db.client.send(command);
          createdMappings.push({ id: mappingId, amName: am.name, action: 'created' });
        }
      }
      
      // Send SSE notification
      try {
        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/sse/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'sa-to-am-mapping-update',
            practiceGroupId: data.practiceGroupId
          })
        });
      } catch (sseError) {
        console.error('SSE notification failed:', sseError);
      }
      
      return NextResponse.json({
        success: true,
        message: `SA to AM mappings updated for ${createdMappings.length} account managers`
      });
    }
    
    // Regular single mapping update
    const allUsers = await db.getAllUsers();
    const amUser = allUsers.find(user => user.role === 'account_manager' && user.name === data.amName);
    const saUser = allUsers.find(user => user.name === data.saName);
    const saEmail = saUser?.email || '';
    const mappingSignature = `${data.saName}|${amUser?.email || ''}|${JSON.stringify(data.practices.sort())}|${data.region}`;
    
    // Track changes for history
    const changes = [];
    const oldSaName = existingMapping.sa_name?.S || '';
    const oldAmName = existingMapping.am_name?.S || '';
    const oldRegion = existingMapping.region?.S || '';
    const oldPractices = JSON.parse(existingMapping.practices?.S || '[]');
    
    if (oldSaName !== data.saName) {
      changes.push({ field: 'Solutions Architect', from: oldSaName, to: data.saName });
    }
    if (oldAmName !== data.amName) {
      changes.push({ field: 'Account Manager', from: oldAmName, to: data.amName });
    }
    if (oldRegion !== data.region) {
      changes.push({ field: 'Region', from: oldRegion, to: data.region });
    }
    if (JSON.stringify(oldPractices.sort()) !== JSON.stringify(data.practices.sort())) {
      changes.push({ field: 'Practices', from: oldPractices, to: data.practices });
    }
    
    const updatedHistory = addHistoryEntry(existingHistory, 'updated', user, timestamp, changes.length > 0 ? changes : null);
    
    const command = new PutItemCommand({
      TableName: tableName,
      Item: {
        ...existingMapping,
        sa_name: { S: data.saName },
        sa_email: { S: saEmail },
        am_name: { S: data.amName },
        am_email: { S: amUser?.email || '' },
        region: { S: data.region },
        practice_group_id: { S: data.practiceGroupId },
        practices: { S: JSON.stringify(data.practices || []) },
        mapping_signature: { S: mappingSignature },
        history: { S: JSON.stringify(updatedHistory) },
        updated_at: { S: timestamp }
      }
    });
    
    await db.client.send(command);
    
    // Send SSE notification
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/sse/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sa-to-am-mapping-update',
          practiceGroupId: data.practiceGroupId
        })
      });
    } catch (sseError) {
      console.error('SSE notification failed:', sseError);
    }
    
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
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const practiceGroupId = searchParams.get('practiceGroupId');
    const tableName = getTableName('SAToAMMappings');
    const user = validation.user;
    const timestamp = new Date().toISOString();
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Mapping ID is required' },
        { status: 400 }
      );
    }
    
    // Get existing mapping to preserve history
    const getCommand = new ScanCommand({
      TableName: tableName,
      FilterExpression: 'id = :id',
      ExpressionAttributeValues: {
        ':id': { S: id }
      }
    });
    
    const getResult = await db.client.send(getCommand);
    if (!getResult.Items || getResult.Items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Mapping not found' },
        { status: 404 }
      );
    }
    
    const existingMapping = getResult.Items[0];
    const existingHistory = JSON.parse(existingMapping.history?.S || '[]');
    
    // Helper function to add history entry with changes
    const addHistoryEntry = (existingHistory, action, user, timestamp, changes = null, reason = null) => {
      const newEntry = {
        action,
        user: user.name || user.email,
        userEmail: user.email,
        timestamp,
        ...(changes && { changes }),
        ...(reason && { reason })
      };
      return [...(existingHistory || []), newEntry];
    };
    
    // Add deletion entry to history
    const updatedHistory = addHistoryEntry(existingHistory, 'deleted', user, timestamp, null, 'Mapping deleted by user');
    
    // Soft delete - mark as deleted but preserve record
    const softDeleteCommand = new PutItemCommand({
      TableName: tableName,
      Item: {
        ...existingMapping,
        is_deleted: { BOOL: true },
        history: { S: JSON.stringify(updatedHistory) },
        updated_at: { S: timestamp }
      }
    });
    
    await db.client.send(softDeleteCommand);
    
    // Send SSE notification
    if (practiceGroupId) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/sse/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'sa-to-am-mapping-update',
            practiceGroupId: practiceGroupId
          })
        });
      } catch (sseError) {
        console.error('SSE notification failed:', sseError);
      }
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