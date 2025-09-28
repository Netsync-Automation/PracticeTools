import { authenticateUser } from './auth.js';
import { db } from './dynamodb.js';

export class AuthHandler {
  static async authenticateUser(email, password) {
    try {
      console.log('[AUTH-HANDLER-DEBUG] Starting authentication for:', email);
      
      // Check if user exists and get auth method
      console.log('[AUTH-HANDLER-DEBUG] Checking if user exists in database');
      const user = await db.getUser(email);
      console.log('[AUTH-HANDLER-DEBUG] User from database:', user ? 'found' : 'not found');
      if (user) {
        console.log('[AUTH-HANDLER-DEBUG] User auth_method:', user.auth_method);
        console.log('[AUTH-HANDLER-DEBUG] User has password:', !!user.password);
        console.log('[AUTH-HANDLER-DEBUG] User role:', user.role);
      }
      
      // Standard local authentication
      console.log('[AUTH-HANDLER-DEBUG] Calling authenticateUser function');
      const result = await authenticateUser(email, password);
      console.log('[AUTH-HANDLER-DEBUG] authenticateUser result:', result ? 'success' : 'failed');
      
      if (result && user) {
        console.log('[AUTH-HANDLER-DEBUG] Authentication successful, returning user');
        // Return complete user object from database
        return { success: true, user: user };
      }
      
      console.log('[AUTH-HANDLER-DEBUG] Authentication failed - invalid credentials');
      return { success: false, error: 'Invalid credentials' };
    } catch (error) {
      console.error('[AUTH-HANDLER-DEBUG] Auth handler error:', error);
      console.error('[AUTH-HANDLER-DEBUG] Error stack:', error.stack);
      return { success: false, error: 'Authentication failed' };
    }
  }



  static async checkUserAuthMethod(email) {
    try {
      console.log('[AUTH-HANDLER-DEBUG] Checking auth method for:', email);
      const user = await db.getUser(email);
      
      if (!user) {
        console.log('[AUTH-HANDLER-DEBUG] User not found, defaulting to local auth');
        return { exists: false, authMethod: 'local' };
      }
      
      console.log('[AUTH-HANDLER-DEBUG] User found, auth method:', user.auth_method || 'local');
      return { 
        exists: true, 
        authMethod: user.auth_method || 'local'
      };
    } catch (error) {
      console.error('[AUTH-HANDLER-DEBUG] Check auth method error:', error);
      return { exists: false, authMethod: 'local' };
    }
  }
}