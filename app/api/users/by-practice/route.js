import { NextResponse } from 'next/server';
import { ScanCommand } from '@aws-sdk/client-dynamodb';
import { getEnvironment, getTableName } from '../../../../lib/dynamodb';
import { db } from '../../../../lib/dynamodb';


export const dynamic = 'force-dynamic';
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const practiceGroupId = searchParams.get('practiceGroupId'); // This is the manager's email
    

    
    if (!practiceGroupId) {
      return NextResponse.json({ success: true, users: [] });
    }

    const tableName = getTableName('Users');
    
    // Get the practice manager to find their practices
    const allUsers = await db.getAllUsers();
    const practiceManager = allUsers.find(user => user.email === practiceGroupId && user.role === 'practice_manager');
    

    
    if (!practiceManager || !practiceManager.practices || practiceManager.practices.length === 0) {
      return NextResponse.json({ success: true, users: [] });
    }
    
    const practices = practiceManager.practices;

    
    // Filter users who have any of these practices
    const filteredUsers = allUsers.filter(user => {
      if (!Array.isArray(user.practices)) return false;
      const hasMatchingPractice = user.practices.some(practice => practices.includes(practice));

      return hasMatchingPractice;
    }).map(user => ({
      id: user.email,
      name: user.name,
      email: user.email
    })).sort((a, b) => a.name.localeCompare(b.name));



    return NextResponse.json({
      success: true,
      users: filteredUsers
    });
  } catch (error) {
    console.error('Error fetching users by practice:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users by practice' },
      { status: 500 }
    );
  }
}