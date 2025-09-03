import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { email, currentPassword, newPassword } = await request.json();
    
    if (!email || !currentPassword || !newPassword) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    // Get user from database
    const user = await db.getUser(email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has a password (for local auth)
    if (!user.password) {
      return NextResponse.json({ error: 'User does not have a local password set' }, { status: 400 });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    // Update password and remove password change requirement
    const success = await db.resetUserPassword(email, newPassword);
    if (!success) {
      return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
    }

    // Remove password change requirement
    await db.updateUser(email, { require_password_change: false });

    // Create user session
    const sessionUser = {
      email: user.email,
      name: user.name,
      role: user.role || 'user',
      auth_method: 'local',
      isAdmin: user.role === 'admin',
      created_at: user.created_at,
      last_login: new Date().toISOString()
    };

    const response = NextResponse.json({ 
      success: true, 
      user: sessionUser
    });

    // Set session cookie
    response.cookies.set('user-session', JSON.stringify(sessionUser), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    });

    return response;
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}