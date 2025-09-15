import { NextResponse } from 'next/server';
import { ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { getTableName } from '../../../../lib/dynamodb';
import { db } from '../../../../lib/dynamodb';

export async function POST(request) {
  try {
    const tableName = getTableName('SAToAMMappings');
    
    // Get all mappings with missing regions
    const scanCommand = new ScanCommand({
      TableName: tableName,
      FilterExpression: 'attribute_not_exists(#region) OR #region = :emptyString',
      ExpressionAttributeNames: {
        '#region': 'region'
      },
      ExpressionAttributeValues: {
        ':emptyString': { S: '' }
      }
    });
    
    const mappingsResult = await db.client.send(scanCommand);
    const mappingsWithoutRegion = mappingsResult.Items || [];
    
    if (mappingsWithoutRegion.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No mappings found with missing regions',
        updatedCount: 0
      });
    }
    
    // Get all users to lookup AM regions
    const allUsers = await db.getAllUsers();
    const amUsers = allUsers.filter(user => user.role === 'account_manager');
    
    let updatedCount = 0;
    
    // Update each mapping with missing region
    for (const mapping of mappingsWithoutRegion) {
      const amEmail = mapping.am_email?.S;
      if (!amEmail) continue;
      
      // Find the AM user and get their region
      const amUser = amUsers.find(user => user.email === amEmail);
      if (!amUser || !amUser.region) continue;
      
      // Update the mapping with the AM's region
      const updateCommand = new UpdateItemCommand({
        TableName: tableName,
        Key: {
          id: { S: mapping.id.S }
        },
        UpdateExpression: 'SET #region = :region',
        ExpressionAttributeNames: {
          '#region': 'region'
        },
        ExpressionAttributeValues: {
          ':region': { S: amUser.region }
        }
      });
      
      await db.client.send(updateCommand);
      updatedCount++;
    }
    
    return NextResponse.json({
      success: true,
      message: `Successfully updated ${updatedCount} mappings with AM regions`,
      updatedCount
    });
    
  } catch (error) {
    console.error('Error syncing AM regions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to sync AM regions' },
      { status: 500 }
    );
  }
}