/**
 * AI User Context Middleware
 * Uses existing auth-check pattern for consistency
 */

import { validateUserSession } from './auth-check.js';
import { logger } from './safe-logger.js';

/**
 * Extract user from request using existing auth pattern
 */
export async function getUserFromRequest(request) {
  try {
    const cookieHeader = request.headers.get('cookie');
    
    if (!cookieHeader) {
      return null;
    }
    
    const cookies = Object.fromEntries(
      cookieHeader.split('; ').map(c => {
        const [key, ...v] = c.split('=');
        return [key, v.join('=')];
      })
    );
    
    const sessionCookie = cookies['user-session'];
    
    if (!sessionCookie) {
      return null;
    }
    
    // Decode URL-encoded cookie
    const decodedCookie = decodeURIComponent(sessionCookie);
    const validation = await validateUserSession({ value: decodedCookie });
    
    if (!validation.valid || !validation.user) {
      return null;
    }
    
    return validation.user;
    
  } catch (error) {
    logger.error('AI user context error', { error: error.message });
    return null;
  }
}

export function isAdmin(user) {
  return user?.isAdmin === true || user?.role === 'admin';
}

export function hasPracticeAccess(user, practice) {
  if (isAdmin(user)) return true;
  if (!user?.practices || !Array.isArray(user.practices)) return false;
  return user.practices.includes(practice);
}

export function hasRegionAccess(user, region) {
  if (isAdmin(user)) return true;
  if (user?.role === 'account_manager' && user?.region === region) return true;
  return false;
}

export async function logAIAccess(user, action, details = {}) {
  try {
    logger.info('AI access audit log', {
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      action,
      timestamp: new Date().toISOString(),
      environment: process.env.ENVIRONMENT || 'dev',
      ...details
    });
  } catch (error) {
    logger.error('Failed to log AI access', { error: error.message });
  }
}
