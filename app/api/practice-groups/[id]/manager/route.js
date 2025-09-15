import { NextResponse } from 'next/server';
import { GetItemCommand } from '@aws-sdk/client-dynamodb';
import { getEnvironment, getTableName } from '../../../../../lib/dynamodb';
import { db } from '../../../../../lib/dynamodb';

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const { ScanCommand } = await import('@aws-sdk/client-dynamodb');
    
    // First get the practice group to find its practices
    const groupResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/practice-groups`);
    const groupData = await groupResponse.json();
    const practiceGroup = groupData.groups?.find(g => g.id === id);
    
    if (!practiceGroup || !practiceGroup.practices) {
      return NextResponse.json({ manager: null });
    }
    
    // Scan Users table for practice managers
    const usersTableName = getTableName('Users');
    const scanCommand = new ScanCommand({
      TableName: usersTableName,
      FilterExpression: '#role = :role',
      ExpressionAttributeNames: {
        '#role': 'role'
      },
      ExpressionAttributeValues: {
        ':role': { S: 'practice_manager' }
      }
    });
    
    const scanResult = await db.client.send(scanCommand);
    
    // Find manager for this practice group
    const practiceManager = scanResult.Items?.find(item => {
      let userPractices = [];
      
      if (item.practices?.S) {
        try {
          userPractices = JSON.parse(item.practices.S);
        } catch (e) {
          userPractices = [];
        }
      } else if (item.practices?.SS) {
        userPractices = item.practices.SS;
      } else if (item.practices?.L) {
        userPractices = item.practices.L.map(p => p.S);
      }
      
      return userPractices.some(practice => practiceGroup.practices.includes(practice));
    });
    
    if (!practiceManager) {
      return NextResponse.json({ manager: null });
    }
    
    const manager = {
      name: practiceManager.name?.S || '',
      email: practiceManager.email?.S || ''
    };
    
    return NextResponse.json({ manager });
  } catch (error) {
    console.error('Error fetching practice manager:', error);
    return NextResponse.json({ manager: null });
  }
}