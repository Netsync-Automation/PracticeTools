import { db } from './dynamodb';

// Force Node.js runtime for database operations
export const runtime = 'nodejs';

export async function validateUserSession(userCookie) {
  if (!userCookie) {
    return { valid: false, error: 'no_session' };
  }

  try {
    const user = JSON.parse(userCookie.value);
    
    if (!user.email) {
      return { valid: false, error: 'invalid_session' };
    }

    // Accept SSO users without DB validation
    if (user.auth_method === 'sso') {
      user.isAdmin = user.role === 'admin' || user.isAdmin;
      return { valid: true, user };
    }

    // Only validate username/password users against database
    const dbUser = await db.getUser(user.email);
    
    if (!dbUser) {
      return { valid: false, error: 'user_not_found' };
    }

    dbUser.isAdmin = dbUser.role === 'admin' || dbUser.isAdmin;
    return { valid: true, user: dbUser };
  } catch (error) {
    console.error('[AUTH-CHECK] Session validation error:', error.message);
    return { valid: false, error: 'invalid_session' };
  }
}