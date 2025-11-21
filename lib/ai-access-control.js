/**
 * AI Access Control Library
 * Uses the same access control methods as the application itself
 * Following DSR compliance and industry best practices
 */

import { filterIssuesByAccess } from './access-control.js';
import { DynamoDBService } from './dynamodb.js';

const db = new DynamoDBService();

/**
 * Get user from email
 */
async function getUserByEmail(email) {
  try {
    return await db.getUser(email);
  } catch (error) {
    return null;
  }
}

/**
 * Filter data using the same methods as the application
 * Returns filtered data and permission info for user feedback
 */
export async function filterDataForUser(dataType, data, userEmail) {
  const user = await getUserByEmail(userEmail);
  
  if (!user) {
    console.log(`filterDataForUser: User not found for ${userEmail}`);
    return { filtered: [], restricted: true, reason: 'User not found' };
  }
  
  console.log(`filterDataForUser: Filtering ${dataType} for user ${userEmail}, ${data.length} items`);
  
  switch (dataType) {
    case 'issues':
      // Use the same filter as /api/issues
      const filtered = filterIssuesByAccess(data, user);
      const restricted = filtered.length < data.length;
      return { 
        filtered, 
        restricted,
        reason: restricted ? 'Some Leadership Questions are restricted to practice leadership' : null
      };
    
    case 'assignments':
    case 'sa_assignments':
      // Application returns all assignments to authenticated users
      return { filtered: data, restricted: false, reason: null };
    
    case 'contacts':
    case 'companies':
      // Application allows all authenticated users to view all contacts
      return { filtered: data, restricted: false, reason: null };
    
    case 'training_certs':
    case 'webex_recordings':
    case 'webex_messages':
    case 'documentation':
    case 'users':
    case 'practice_info':
    case 'releases':
    case 'sa_mappings':
      // All accessible to authenticated users
      return { filtered: data, restricted: false, reason: null };
    
    default:
      return { filtered: [], restricted: true, reason: 'Unknown data type' };
  }
}

/**
 * Sanitize data before sending to AI
 */
export function sanitizeDataForAI(dataType, data) {
  const sensitiveFields = ['password', 'auth_method', 'require_password_change'];
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeDataForAI(dataType, item));
  }
  
  const sanitized = { ...data };
  sensitiveFields.forEach(field => delete sanitized[field]);
  return sanitized;
}
