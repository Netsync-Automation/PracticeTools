import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';
import { validateUserSession } from '../../../../lib/auth-check';

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
    
    // Allow admins full access, practice managers/principals filtered access
    if (user.isAdmin) {
      const users = await db.getAllUsers();
      return NextResponse.json({ users });
    } else if (user.role === 'practice_manager' || user.role === 'practice_principal') {
      const allUsers = await db.getAllUsers();
      // For practice managers/principals, they can see all users but filtering will be applied on frontend
      // This allows them to manage users within their practice teams
      return NextResponse.json({ users: allUsers });
    } else {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}