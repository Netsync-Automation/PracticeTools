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
    if (email === DEFAULT_ADMIN.email) {
      if (password === DEFAULT_ADMIN.password) {
        return {
          email: DEFAULT_ADMIN.email,
          name: DEFAULT_ADMIN.name,
          role: 'admin',
          isAdmin: true
        };
      }
    }
    
    const user = await db.getUser(email);
    if (user && user.auth_method === 'local') {
      return {
        email: user.email,
        name: user.name,
        role: user.role,
        isAdmin: user.role === 'admin'
      };
    }
    
    return null;
  } catch (error) {
    console.error('Authentication error:', error);
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