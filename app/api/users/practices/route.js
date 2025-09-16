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
    
    // Any authenticated user can access this endpoint
    const allUsers = await db.getAllUsers();
    
    // Return only the data needed for practice-SA mapping
    const practiceUsers = allUsers.map(user => ({
      name: user.name,
      email: user.email,
      practices: user.practices || [],
      role: user.role
    }));
    
    return NextResponse.json({ users: practiceUsers });
  } catch (error) {
    console.error('Error fetching users for practices:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}