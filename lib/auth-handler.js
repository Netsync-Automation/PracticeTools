import { authenticateUser } from './auth.js';
import { db } from './dynamodb.js';

export class AuthHandler {
  static async authenticateUser(email, password) {
    try {
      // Check if user exists and get auth method
      const user = await db.getUser(email);
      

      
      // Standard local authentication
      const result = await authenticateUser(email, password);
      if (result && user) {
        // Return complete user object from database
        return { success: true, user: user };
      }
      
      return { success: false, error: 'Invalid credentials' };
    } catch (error) {
      console.error('Auth handler error:', error);
      return { success: false, error: 'Authentication failed' };
    }
  }



  static async checkUserAuthMethod(email) {
    try {
      const user = await db.getUser(email);
      
      if (!user) {
        return { exists: false, authMethod: 'local' };
      }
      
      return { 
        exists: true, 
        authMethod: user.auth_method || 'local'
      };
    } catch (error) {
      console.error('Check auth method error:', error);
      return { exists: false, authMethod: 'local' };
    }
  }
}