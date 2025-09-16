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
    const canViewDeleted = user.isAdmin || user.role === 'executive' || 
      (['practice_manager', 'practice_principal'].includes(user.role) && 
       user.practices?.some(practice => practiceGroupId?.includes(practice)));
    
    if (!canViewDeleted) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const deletedCompanies = await db.getAllDeletedCompanies(practiceGroupId);
    return NextResponse.json({ companies: deletedCompanies });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch deleted companies' }, { status: 500 });
  }
}