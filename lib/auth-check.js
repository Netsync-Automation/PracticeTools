import { db } from './dynamodb';

// Force Node.js runtime for database operations
export const runtime = 'nodejs';

export async function validateUserSession(userCookie) {
  console.log('[AUTH-CHECK-DEBUG] validateUserSession called');
  console.log('[AUTH-CHECK-DEBUG] userCookie exists:', !!userCookie);
  
  if (!userCookie) {
    console.log('[AUTH-CHECK-DEBUG] No user cookie found');
    return { valid: false, error: 'no_session' };
  }

  try {
    console.log('[AUTH-CHECK-DEBUG] Parsing user cookie');
    const user = JSON.parse(userCookie.value);
    console.log('[AUTH-CHECK-DEBUG] Parsed user:', {
      email: user?.email,
      auth_method: user?.auth_method,
      role: user?.role
    });
    
    if (!user.email) {
      console.log('[AUTH-CHECK-DEBUG] No email in user session');
      return { valid: false, error: 'invalid_session' };
    }

    // Accept SSO users without DB validation
    if (user.auth_method === 'sso') {
      console.log('[AUTH-CHECK-DEBUG] SSO user, accepting without DB validation');
      return { valid: true, user };
    }

    // Only validate username/password users against database
    console.log('[AUTH-CHECK-DEBUG] Getting user from database for validation');
    const dbUser = await db.getUser(user.email);
    console.log('[AUTH-CHECK-DEBUG] Database user found:', !!dbUser);
    
    if (!dbUser) {
      console.log('[AUTH-CHECK-DEBUG] User not found in database');
      return { valid: false, error: 'user_not_found' };
    }

    console.log('[AUTH-CHECK-DEBUG] Session validation successful');
    return { valid: true, user: dbUser };
  } catch (error) {
    console.error('[AUTH-CHECK-DEBUG] Session validation error:', error.message);
    console.error('[AUTH-CHECK-DEBUG] Error stack:', error.stack);
    return { valid: false, error: 'invalid_session' };
  }
}