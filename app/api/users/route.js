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
    
    if (!user.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    const users = await db.getAllUsers();
    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export async function POST(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = validation.user;
    
    if (!user.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    const { email, name, password, role, auth_method, specifyPassword, isAdmin, practices } = await request.json();
    
    if (!email || !name) {
      return NextResponse.json({ error: 'Email and name are required' }, { status: 400 });
    }
    
    let finalPassword = password;
    let requirePasswordChange = false;
    
    // Generate password if not specified
    if (auth_method === 'local' && !specifyPassword) {
      finalPassword = generatePassword();
      requirePasswordChange = true;
    }
    
    if (auth_method === 'local' && !finalPassword) {
      return NextResponse.json({ error: 'Password is required for local users' }, { status: 400 });
    }
    
    const success = await db.createOrUpdateUser(
      email, 
      name, 
      auth_method || 'local', 
      role || 'practice_member', 
      finalPassword,
      'manual',
      requirePasswordChange,
      isAdmin || false,
      practices || []
    );
    
    if (success && auth_method === 'local') {
      // Send welcome email for all local users
      try {
        const emailResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/email/welcome-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            name,
            password: finalPassword,
            role,
            isTemporary: !specifyPassword
          })
        });
        
        if (!emailResponse.ok) {
          console.error('Failed to send welcome email');
        }
      } catch (emailError) {
        console.error('Error sending welcome email:', emailError);
      }
    }
    
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}