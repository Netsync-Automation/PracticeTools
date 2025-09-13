import { NextResponse } from 'next/server';
import { GetItemCommand } from '@aws-sdk/client-dynamodb';
import { getEnvironment, getTableName } from '../../../../../lib/dynamodb';
import { db } from '../../../../../lib/dynamodb';

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const tableName = getTableName('PracticeGroups');
    const environment = getEnvironment();
    
    // Get practice group
    const groupCommand = new GetItemCommand({
      TableName: tableName,
      Key: {
        id: { S: id }
      }
    });
    
    const groupResult = await db.client.send(groupCommand);
    
    if (!groupResult.Item) {
      return NextResponse.json({ manager: null });
    }
    
    const practiceManagerEmail = groupResult.Item.practiceManagerEmail?.S;
    
    if (!practiceManagerEmail) {
      return NextResponse.json({ manager: null });
    }
    
    // Get practice manager details
    const usersTableName = getTableName('Users');
    const userCommand = new GetItemCommand({
      TableName: usersTableName,
      Key: {
        email: { S: practiceManagerEmail }
      }
    });
    
    const userResult = await db.client.send(userCommand);
    
    if (!userResult.Item) {
      return NextResponse.json({ manager: null });
    }
    
    const manager = {
      name: userResult.Item.name?.S || '',
      email: userResult.Item.email?.S || ''
    };
    
    return NextResponse.json({ manager });
  } catch (error) {
    console.error('Error fetching practice manager:', error);
    return NextResponse.json({ manager: null });
  }
}