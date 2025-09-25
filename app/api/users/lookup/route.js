import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';
import { validateUserSession } from '../../../../lib/auth-check';

export async function GET(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    console.log('[USERS-LOOKUP] Cookie check:', { hasCookie: !!userCookie });
    
    const validation = await validateUserSession(userCookie);
    console.log('[USERS-LOOKUP] Validation result:', { valid: validation.valid, error: validation.error });
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized', details: validation.error }, { status: 401 });
    }
    
    const users = await db.getAllUsers();
    return NextResponse.json({ users });
  } catch (error) {
    console.error('[USERS-LOOKUP] Error:', error);
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    
    const user = await db.getUser(email);
    if (user) {
      return NextResponse.json({ name: user.name, email: user.email });
    } else {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('[USERS-LOOKUP] POST Error:', error);
    return NextResponse.json({ error: 'Failed to lookup user' }, { status: 500 });
  }
}