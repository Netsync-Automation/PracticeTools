import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';
import { validateUserSession } from '../../../../lib/auth-check';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid || !validation.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const users = await db.getAllUsers();
    const admins = users.filter(user => user.role === 'admin').map(admin => ({
      name: admin.name,
      email: admin.email
    }));
    
    return NextResponse.json({ admins });
  } catch (error) {
    console.error('Error fetching admins:', error);
    return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 });
  }
}