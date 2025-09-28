import bcrypt from 'bcryptjs';
import { db } from './dynamodb';

const DEFAULT_ADMIN = {
  email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@localhost',
  password: process.env.DEFAULT_ADMIN_PASSWORD || 'ChangeMe123!',
  name: process.env.DEFAULT_ADMIN_NAME || 'Administrator',
  role: 'admin'
};

export async function authenticateUser(email, password) {
  try {
    console.log('[AUTH-DEBUG] Starting authentication for:', email);
    console.log('[AUTH-DEBUG] Default admin email:', DEFAULT_ADMIN.email);
    
    if (email === DEFAULT_ADMIN.email) {
      console.log('[AUTH-DEBUG] Checking default admin credentials');
      if (password === DEFAULT_ADMIN.password) {
        console.log('[AUTH-DEBUG] Default admin authentication successful');
        return {
          email: DEFAULT_ADMIN.email,
          name: DEFAULT_ADMIN.name,
          role: 'admin',
          isAdmin: true
        };
      }
      console.log('[AUTH-DEBUG] Default admin password mismatch');
    }
    
    console.log('[AUTH-DEBUG] Getting user from database');
    const user = await db.getUser(email);
    console.log('[AUTH-DEBUG] User found:', !!user);
    
    if (user) {
      console.log('[AUTH-DEBUG] User auth_method:', user.auth_method);
      console.log('[AUTH-DEBUG] User has password:', !!user.password);
      
      if (user.auth_method === 'local') {
        console.log('[AUTH-DEBUG] User is local auth, checking password');
        
        if (user.password) {
          console.log('[AUTH-DEBUG] Comparing password with bcrypt');
          const passwordMatch = await bcrypt.compare(password, user.password);
          console.log('[AUTH-DEBUG] Password match:', passwordMatch);
          
          if (passwordMatch) {
            console.log('[AUTH-DEBUG] Local user authentication successful');
            return {
              email: user.email,
              name: user.name,
              role: user.role,
              isAdmin: user.role === 'admin'
            };
          }
        } else {
          console.log('[AUTH-DEBUG] Local user has no password hash');
        }
      } else {
        console.log('[AUTH-DEBUG] User is not local auth method');
      }
    }
    
    console.log('[AUTH-DEBUG] Authentication failed - returning null');
    return null;
  } catch (error) {
    console.error('[AUTH-DEBUG] Authentication error:', error);
    console.error('[AUTH-DEBUG] Error stack:', error.stack);
    return null;
  }
}

export function isAdmin(user) {
  return user?.role === 'admin' || user?.isAdmin === true;
}

export function requireAuth(user) {
  return !!user;
}

export function requireAdmin(user) {
  return requireAuth(user) && isAdmin(user);
}