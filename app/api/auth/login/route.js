import { NextResponse } from 'next/server';
import { AuthHandler } from '../../../../lib/auth-handler';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }
    
    const result = await AuthHandler.authenticateUser(email, password);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }
    
    // Check if password change is required
    if (result.user.require_password_change) {
      return NextResponse.json({ 
        success: true,
        requirePasswordChange: true,
        user: {
          email: result.user.email,
          name: result.user.name
        }
      });
    }
    
    // Create user session object matching SAML pattern
    const user = {
      email: result.user.email,
      name: result.user.name,
      role: result.user.role || 'user',
      auth_method: 'local',
      isAdmin: result.user.role === 'admin',
      created_at: result.user.created_at,
      last_login: new Date().toISOString()
    };
    
    const response = NextResponse.json({ 
      success: true, 
      user: user
    });
    
    // Set session cookie using same pattern as SAML
    response.cookies.set('user-session', JSON.stringify(user), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    });
    
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}