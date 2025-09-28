import { NextResponse } from 'next/server';
import { AuthHandler } from '../../../../lib/auth-handler';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    console.log('[LOGIN-DEBUG] Login attempt started');
    const { email, password } = await request.json();
    console.log('[LOGIN-DEBUG] Email:', email);
    console.log('[LOGIN-DEBUG] Password provided:', !!password);
    console.log('[LOGIN-DEBUG] Environment:', process.env.NODE_ENV);
    console.log('[LOGIN-DEBUG] AWS Region:', process.env.AWS_DEFAULT_REGION);
    
    if (!email || !password) {
      console.log('[LOGIN-DEBUG] Missing email or password');
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }
    
    console.log('[LOGIN-DEBUG] Calling AuthHandler.authenticateUser');
    const result = await AuthHandler.authenticateUser(email, password);
    console.log('[LOGIN-DEBUG] AuthHandler result:', { success: result.success, error: result.error });
    
    if (!result.success) {
      console.log('[LOGIN-DEBUG] Authentication failed:', result.error);
      return NextResponse.json({ error: result.error }, { status: 401 });
    }
    
    console.log('[LOGIN-DEBUG] User object:', result.user);
    
    // Check if password change is required
    if (result.user.require_password_change) {
      console.log('[LOGIN-DEBUG] Password change required');
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
    
    console.log('[LOGIN-DEBUG] Session user object:', user);
    
    const response = NextResponse.json({ 
      success: true, 
      user: user
    });
    
    // Set session cookie using same pattern as SAML
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    };
    console.log('[LOGIN-DEBUG] Cookie options:', cookieOptions);
    
    response.cookies.set('user-session', JSON.stringify(user), cookieOptions);
    console.log('[LOGIN-DEBUG] Login successful, returning response');
    
    return response;
  } catch (error) {
    console.error('[LOGIN-DEBUG] Login error:', error);
    console.error('[LOGIN-DEBUG] Error stack:', error.stack);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}