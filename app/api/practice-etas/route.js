import { NextResponse } from 'next/server';
import { ScanCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { getEnvironment, getTableName } from '../../../lib/dynamodb';
import { db } from '../../../lib/dynamodb';
import { v4 as uuidv4 } from 'uuid';


export const dynamic = 'force-dynamic';
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const practice = searchParams.get('practice');
    const practices = searchParams.get('practices');
    const saName = searchParams.get('saName');
    
    const tableName = getTableName('PracticeETAs');
    
    let command;
    if (practice || practices || saName) {
      let filterExpression = '';
      let expressionAttributeValues = {};
      
      if (practices) {
        const practiceList = practices.split(',').map(p => p.trim());
        const practiceConditions = practiceList.map((_, index) => `practice = :practice${index}`).join(' OR ');
        filterExpression = `(${practiceConditions})`;
        practiceList.forEach((p, index) => {
          expressionAttributeValues[`:practice${index}`] = { S: p };
        });
      } else if (practice) {
        filterExpression = 'practice = :practice';
        expressionAttributeValues[':practice'] = { S: practice };
      }
      
      if (saName) {
        if (filterExpression) filterExpression += ' AND ';
        filterExpression += 'sa_name = :saName';
        expressionAttributeValues[':saName'] = { S: saName };
      }
      
      command = new ScanCommand({
        TableName: tableName,
        FilterExpression: filterExpression,
        ExpressionAttributeValues: expressionAttributeValues
      });
    } else {
      command = new ScanCommand({ TableName: tableName });
    }
    
    const result = await db.client.send(command);
    const etas = (result.Items || []).map(item => ({
      id: item.id?.S || '',
      practice: item.practice?.S || '',
      saName: item.sa_name?.S || '',
      statusTransition: item.status_transition?.S || '',
      avgDurationHours: parseFloat(item.avg_duration_hours?.N || '0'),
      sampleCount: parseInt(item.sample_count?.N || '0'),
      lastUpdated: item.last_updated?.S || '',
      createdAt: item.created_at?.S || ''
    }));
    
    return NextResponse.json({ success: true, etas });
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      await createPracticeETAsTable(getTableName('PracticeETAs'));
      return NextResponse.json({ success: true, etas: [] });
    }
    console.error('Error fetching practice ETAs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch practice ETAs' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    const { practice, saName, statusTransition, durationHours } = data;
    
    if (!practice || !statusTransition || durationHours === undefined) {
      return NextResponse.json(
        { success: false, error: 'Practice, status transition, and duration are required' },
        { status: 400 }
      );
    }
    
    const environment = getEnvironment();
    const tableName = getTableName('PracticeETAs');
    const timestamp = new Date().toISOString();
    
    // Find existing ETA record
    const scanCommand = new ScanCommand({
      TableName: tableName,
      FilterExpression: 'practice = :practice AND status_transition = :transition' + 
                       (saName ? ' AND sa_name = :saName' : ''),
      ExpressionAttributeValues: {
        ':practice': { S: practice },
        ':transition': { S: statusTransition },
        ...(saName && { ':saName': { S: saName } })
      }
    });
    
    const existingResult = await db.client.send(scanCommand);
    
    let id, avgDuration, sampleCount;
    
    if (existingResult.Items && existingResult.Items.length > 0) {
      // Update existing record
      const existing = existingResult.Items[0];
      id = existing.id.S;
      const currentAvg = parseFloat(existing.avg_duration_hours?.N || '0');
      const currentCount = parseInt(existing.sample_count?.N || '0');
      
      // Calculate new rolling average
      sampleCount = currentCount + 1;
      avgDuration = ((currentAvg * currentCount) + durationHours) / sampleCount;
    } else {
      // Create new record
      id = uuidv4();
      avgDuration = durationHours;
      sampleCount = 1;
    }
    
    const command = new PutItemCommand({
      TableName: tableName,
      Item: {
        id: { S: id },
        practice: { S: practice },
        sa_name: { S: saName || '' },
        status_transition: { S: statusTransition },
        avg_duration_hours: { N: avgDuration.toString() },
        sample_count: { N: sampleCount.toString() },
        last_updated: { S: timestamp },
        created_at: { S: timestamp },
        environment: { S: environment }
      }
    });
    
    await db.client.send(command);
    
    return NextResponse.json({
      success: true,
      message: 'Practice ETA updated successfully',
      eta: {
        id,
        practice,
        saName: saName || '',
        statusTransition,
        avgDurationHours: avgDuration,
        sampleCount
      }
    });
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      await createPracticeETAsTable(getTableName('PracticeETAs'));
      return POST(request);
    }
    console.error('Error updating practice ETA:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update practice ETA' },
      { status: 500 }
    );
  }
}

async function createPracticeETAsTable(tableName) {
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
    console.log('Practice ETAs table created successfully');
    return true;
  } catch (error) {
    console.error('Error creating Practice ETAs table:', error);
    return false;
  }
}