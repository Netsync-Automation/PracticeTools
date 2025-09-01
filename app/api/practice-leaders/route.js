import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb';
import { validateUserSession } from '../../../lib/auth-check';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = validation.user;
    
    // Allow admins, practice managers, and practice principals
    if (!user.isAdmin && user.role !== 'practice_manager' && user.role !== 'practice_principal') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    const allUsers = await db.getAllUsers();
    const practiceLeaders = allUsers.filter(u => 
      u.role === 'practice_manager' || u.role === 'practice_principal'
    );
    
    return NextResponse.json({ leaders: practiceLeaders });
  } catch (error) {
    console.error('Error fetching practice leaders:', error);
    return NextResponse.json({ error: 'Failed to fetch practice leaders' }, { status: 500 });
  }
}