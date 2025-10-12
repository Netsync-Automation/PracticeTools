import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/dynamodb.js';
import { validateUserSession } from '../../../../../lib/auth-check.js';


export const dynamic = 'force-dynamic';
export async function GET(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const practiceGroupId = searchParams.get('practiceGroupId');
    
    if (!practiceGroupId) {
      return NextResponse.json({ error: 'Practice group ID is required' }, { status: 400 });
    }

    // Check permissions
    const user = validation.user;
    let canViewDeleted = user.isAdmin || user.role === 'executive';
    
    // For practice managers and principals, check if they have access to any practices in this group
    if (!canViewDeleted && ['practice_manager', 'practice_principal'].includes(user.role) && user.practices) {
      // Get the practice group to find its practices
      try {
        const practiceGroupsResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/practice-groups`);
        if (practiceGroupsResponse.ok) {
          const practiceGroupsData = await practiceGroupsResponse.json();
          const selectedGroup = practiceGroupsData.groups?.find(group => group.id === practiceGroupId);
          if (selectedGroup) {
            canViewDeleted = selectedGroup.practices.some(practice => user.practices.includes(practice));
          }
        }
      } catch (error) {
        console.error('Error checking practice group permissions:', error);
      }
    }
    
    if (!canViewDeleted) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const deletedCompanies = await db.getAllDeletedCompanies(practiceGroupId);
    return NextResponse.json({ companies: deletedCompanies });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch deleted companies' }, { status: 500 });
  }
}