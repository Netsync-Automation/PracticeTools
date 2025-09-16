import { NextResponse } from 'next/server';
import { PutItemCommand, ScanCommand, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { getEnvironment, getTableName } from '../../../lib/dynamodb';
import { db } from '../../../lib/dynamodb';
import { validateUserSession } from '../../../lib/auth-check';


export const dynamic = 'force-dynamic';
export async function GET(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const tableName = getTableName('Regions');
    
    try {
      const command = new ScanCommand({
        TableName: tableName
      });
      
      const result = await db.client.send(command);
      const regions = (result.Items || []).map(item => ({
        code: item.code?.S || '',
        name: item.name?.S || '',
        active: item.active?.BOOL !== false
      })).filter(region => region.active);
      
      return NextResponse.json({
        success: true,
        regions: regions.sort((a, b) => a.name.localeCompare(b.name))
      });
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        await createRegionsTable(tableName);
        await seedRegionsData(tableName);
        
        // Return default regions after seeding
        const command = new ScanCommand({
          TableName: tableName
        });
        
        const result = await db.client.send(command);
        const regions = (result.Items || []).map(item => ({
          code: item.code?.S || '',
          name: item.name?.S || '',
          active: item.active?.BOOL !== false
        })).filter(region => region.active);
        
        return NextResponse.json({
          success: true,
          regions: regions.sort((a, b) => a.name.localeCompare(b.name))
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error fetching regions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch regions' },
      { status: 500 }
    );
  }
}

async function createRegionsTable(tableName) {
  try {
    const command = new CreateTableCommand({
      TableName: tableName,
      KeySchema: [{ AttributeName: 'code', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'code', AttributeType: 'S' }],
      BillingMode: 'PAY_PER_REQUEST'
    });
    await db.client.send(command);
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('Regions table created successfully');
  } catch (error) {
    console.error('Error creating regions table:', error);
  }
}

async function seedRegionsData(tableName) {
  const regions = [
    { code: 'CA-LAX', name: 'CA-LAX' },
    { code: 'CA-SAN', name: 'CA-SAN' },
    { code: 'CA-SFO', name: 'CA-SFO' },
    { code: 'FL-MIA', name: 'FL-MIA' },
    { code: 'FL-NORT', name: 'FL-NORT' },
    { code: 'KY-KENT', name: 'KY-KENT' },
    { code: 'LA-STATE', name: 'LA-STATE' },
    { code: 'OK-OKC', name: 'OK-OKC' },
    { code: 'OTHERS', name: 'OTHERS' },
    { code: 'TN-TEN', name: 'TN-TEN' },
    { code: 'TX-CEN', name: 'TX-CEN' },
    { code: 'TX-DAL', name: 'TX-DAL' },
    { code: 'TX-HOU', name: 'TX-HOU' },
    { code: 'TX-SOUT', name: 'TX-SOUT' },
    { code: 'US-FED', name: 'US-FED' },
    { code: 'US-SP', name: 'US-SP' }
  ];
  
  const environment = getEnvironment();
  
  for (const region of regions) {
    try {
      const command = new PutItemCommand({
        TableName: tableName,
        Item: {
          code: { S: region.code },
          name: { S: region.name },
          active: { BOOL: true },
          environment: { S: environment },
          created_at: { S: new Date().toISOString() }
        }
      });
      await db.client.send(command);
    } catch (error) {
      console.error(`Error seeding region ${region.code}:`, error);
    }
  }
}