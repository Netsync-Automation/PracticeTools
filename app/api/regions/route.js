import { NextResponse } from 'next/server';
import { ScanCommand } from '@aws-sdk/client-dynamodb';
import { getEnvironment, getTableName } from '../../../lib/dynamodb';
import { db } from '../../../lib/dynamodb';

export async function GET() {
  try {
    const environment = getEnvironment();
    const tableName = getTableName('Regions');
    
    // Query the actual DynamoDB regions table
    const command = new ScanCommand({
      TableName: tableName
    });
    
    const result = await db.client.send(command);
    
    const regions = (result.Items || []).map(item => ({
      id: item.id?.S || '',
      name: item.name?.S || '',
      environment
    })).sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      success: true,
      regions: regions
    });
  } catch (error) {
    console.error('Error fetching regions:', error);
    
    // If table doesn't exist, create it with default regions from resource assignments
    if (error.name === 'ResourceNotFoundException') {
      await createRegionsTable();
      
      const defaultRegions = [
        { id: '1', name: 'CA-LAX', environment: getEnvironment() },
        { id: '2', name: 'CA-SAN', environment: getEnvironment() },
        { id: '3', name: 'CA-SFO', environment: getEnvironment() },
        { id: '4', name: 'FL-MIA', environment: getEnvironment() },
        { id: '5', name: 'FL-NORT', environment: getEnvironment() },
        { id: '6', name: 'KY-KENT', environment: getEnvironment() },
        { id: '7', name: 'LA-STATE', environment: getEnvironment() },
        { id: '8', name: 'OK-OKC', environment: getEnvironment() },
        { id: '9', name: 'OTHERS', environment: getEnvironment() },
        { id: '10', name: 'TN-TEN', environment: getEnvironment() },
        { id: '11', name: 'TX-CEN', environment: getEnvironment() },
        { id: '12', name: 'TX-DAL', environment: getEnvironment() },
        { id: '13', name: 'TX-HOU', environment: getEnvironment() },
        { id: '14', name: 'TX-SOUT', environment: getEnvironment() },
        { id: '15', name: 'US-FED', environment: getEnvironment() },
        { id: '16', name: 'US-SP', environment: getEnvironment() }
      ];
      
      // Populate the table with default regions
      for (const region of defaultRegions) {
        await addRegionToTable(region);
      }
      
      return NextResponse.json({
        success: true,
        regions: defaultRegions
      });
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to fetch regions' },
      { status: 500 }
    );
  }
}

async function createRegionsTable() {
  try {
    const { CreateTableCommand } = await import('@aws-sdk/client-dynamodb');
    const command = new CreateTableCommand({
      TableName: getTableName('Regions'),
      KeySchema: [
        {
          AttributeName: 'id',
          KeyType: 'HASH'
        }
      ],
      AttributeDefinitions: [
        {
          AttributeName: 'id',
          AttributeType: 'S'
        }
      ],
      BillingMode: 'PAY_PER_REQUEST'
    });
    await db.client.send(command);
    await new Promise(resolve => setTimeout(resolve, 10000));
    return true;
  } catch (error) {
    console.error('Error creating Regions table:', error);
    return false;
  }
}

async function addRegionToTable(region) {
  try {
    const { PutItemCommand } = await import('@aws-sdk/client-dynamodb');
    const command = new PutItemCommand({
      TableName: getTableName('Regions'),
      Item: {
        id: { S: region.id },
        name: { S: region.name },
        environment: { S: region.environment },
        created_at: { S: new Date().toISOString() }
      }
    });
    await db.client.send(command);
    return true;
  } catch (error) {
    console.error('Error adding region to table:', error);
    return false;
  }
}