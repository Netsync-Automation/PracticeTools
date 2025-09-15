import { db } from './dynamodb.js';
import { logger } from './safe-logger.js';
import { autoMappingUtility } from './auto-mapping-utility.js';

/**
 * Ensures a user exists in the system, creating them if they don't exist
 * @param {string} userString - User string in format "Name <email>" or just "email"
 * @param {string} role - Role to assign (account_manager or isr)
 * @returns {Promise<Object|null>} User object or null if failed
 */
export async function ensureUserExists(userString, role) {
  if (!userString || !role) {
    logger.warn('ensureUserExists called with missing parameters', { userString, role });
    return null;
  }

  try {
    // Parse user string to extract name and email
    const { name, email } = parseUserString(userString);
    
    if (!email) {
      logger.warn('No valid email found in user string', { userString });
      return null;
    }

    // Check if user already exists
    const existingUser = await db.getUser(email);
    
    if (existingUser) {
      logger.info('User already exists', { email, existingRole: existingUser.role });
      return existingUser;
    }

    // Create new user with SYSTEM source and SSO auth
    // For account managers, set status to 'staged' if no region available
    const status = role === 'account_manager' ? 'staged' : 'active';
    
    const success = await db.createOrUpdateUser(
      email,
      name || email, // Use email as name if no name provided
      'sso', // auth_method
      role, // role (account_manager or isr)
      null, // password
      'SYSTEM', // createdFrom
      false, // requirePasswordChange
      false, // isAdmin
      [], // practices (empty for company-wide roles)
      status, // status (staged for AMs without region)
      null, // webexBotSource
      null // region (null for staged AMs)
    );

    if (success) {
      const newUser = await db.getUser(email);
      logger.info('Created new user from SA assignment', { 
        email, 
        name: name || email, 
        role,
        status,
        source: 'SYSTEM'
      });
      
      // If this is a new Account Manager, create mappings for existing "All" mappings
      if (role === 'account_manager') {
        try {
          await autoMappingUtility.createMappingsForNewAM(email);
        } catch (error) {
          logger.error('Failed to create auto-mappings for new AM', { email, error: error.message });
        }
      }
      
      return newUser;
    } else {
      logger.error('Failed to create user', { email, role });
      return null;
    }

  } catch (error) {
    logger.error('Error ensuring user exists', { 
      error: error.message, 
      userString, 
      role 
    });
    return null;
  }
}

/**
 * Parses a user string to extract name and email
 * @param {string} userString - User string in format "Name <email>" or just "email"
 * @returns {Object} Object with name and email properties
 */
function parseUserString(userString) {
  if (!userString) {
    return { name: '', email: '' };
  }

  const trimmed = userString.trim();
  
  // Check for "Name <email>" format
  const angleMatch = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
  if (angleMatch) {
    return {
      name: angleMatch[1].trim(),
      email: angleMatch[2].trim().toLowerCase()
    };
  }

  // Check if it's just an email
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (emailRegex.test(trimmed)) {
    return {
      name: '',
      email: trimmed.toLowerCase()
    };
  }

  // If no valid format found, return empty
  return { name: '', email: '' };
}

/**
 * Processes AM and ISR fields from SA assignment and ensures users exist
 * @param {string} am - AM field value
 * @param {string} isr - ISR field value
 * @returns {Promise<Object>} Object with processed AM and ISR user info including region
 */
export async function processAmIsrUsers(am, isr) {
  const result = {
    amUser: null,
    isrUser: null,
    amProcessed: am || '',
    isrProcessed: isr || '',
    amRegion: null
  };

  try {
    // Process AM if provided
    if (am && am.trim()) {
      const amUser = await ensureUserExists(am.trim(), 'account_manager');
      if (amUser) {
        result.amUser = amUser;
        result.amRegion = amUser.region; // Extract region from existing user
        logger.info('AM user processed successfully', { 
          email: amUser.email, 
          region: amUser.region,
          status: amUser.status,
          existed: amUser.created_from !== 'SYSTEM' 
        });
      }
    }

    // Process ISR if provided
    if (isr && isr.trim()) {
      const isrUser = await ensureUserExists(isr.trim(), 'isr');
      if (isrUser) {
        result.isrUser = isrUser;
        logger.info('ISR user processed successfully', { 
          email: isrUser.email, 
          existed: isrUser.created_from !== 'SYSTEM' 
        });
      }
    }

  } catch (error) {
    logger.error('Error processing AM/ISR users', { 
      error: error.message, 
      am, 
      isr 
    });
  }

  return result;
}