import { NextResponse } from 'next/server';
import { ScanCommand } from '@aws-sdk/client-dynamodb';
import { getEnvironment, getTableName } from '../../../../lib/dynamodb';
import { db } from '../../../../lib/dynamodb';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const practiceGroupId = searchParams.get('practiceGroupId'); // This is the manager's email
    
    console.log('[DEBUG] Fetching users for practice group (manager email):', practiceGroupId);
    
    if (!practiceGroupId) {
      return NextResponse.json({ success: true, users: [] });
    }

    const tableName = getTableName('Users');
    
    // Get the practice manager to find their practices
    const allUsers = await db.getAllUsers();
    const practiceManager = allUsers.find(user => user.email === practiceGroupId && user.role === 'practice_manager');
    
    console.log('[DEBUG] Practice manager found:', {
      email: practiceManager?.email,
      name: practiceManager?.name,
      practices: practiceManager?.practices
    });
    
    if (!practiceManager || !practiceManager.practices || practiceManager.practices.length === 0) {
      console.log('[DEBUG] No practice manager found or no practices');
      return NextResponse.json({ success: true, users: [] });
    }
    
    const practices = practiceManager.practices;
    console.log('[DEBUG] Manager practices:', practices);
    
    // Filter users who have any of these practices
    const filteredUsers = allUsers.filter(user => {
      if (!Array.isArray(user.practices)) return false;
      const hasMatchingPractice = user.practices.some(practice => practices.includes(practice));
      if (hasMatchingPractice) {
        console.log('[DEBUG] User matches:', user.name, 'practices:', user.practices);
      }
      return hasMatchingPractice;
    }).map(user => ({
      id: user.email,
      name: user.name,
      email: user.email
    })).sort((a, b) => a.name.localeCompare(b.name));

    console.log('[DEBUG] Filtered users count:', filteredUsers.length);
    console.log('[DEBUG] Filtered users:', filteredUsers);

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