import { db } from './dynamodb.js';
import { logger } from './safe-logger.js';

/**
 * DSR-compliant email processor for resource assignments
 * Ensures all email fields are properly populated from user database
 */
export class AssignmentEmailProcessor {
  
  /**
   * Process and validate all email fields for an assignment
   * Provides backwards compatibility by looking up missing emails
   */
  static async processAssignmentEmails(assignment) {
    try {
      const users = await db.getAllUsers();
      const updates = {};
      let needsUpdate = false;

      // Process Account Manager email
      if (assignment.am && !assignment.am_email) {
        const amEmail = this.extractEmailFromField(assignment.am, users);
        if (amEmail) {
          updates.am_email = amEmail;
          needsUpdate = true;
          logger.info('DSR: Populated missing AM email', { am: assignment.am, amEmail });
        }
      }

      // Process Project Manager email
      if (assignment.pm && !assignment.pm_email) {
        const pmEmail = this.extractEmailFromField(assignment.pm, users);
        if (pmEmail) {
          updates.pm_email = pmEmail;
          needsUpdate = true;
          logger.info('DSR: Populated missing PM email', { pm: assignment.pm, pmEmail });
        }
      }

      // Process Resource Assigned email
      if (assignment.resourceAssigned && !assignment.resource_assigned_email) {
        const resourceEmail = this.extractEmailFromResourceField(assignment.resourceAssigned, users);
        if (resourceEmail) {
          updates.resource_assigned_email = resourceEmail;
          needsUpdate = true;
          logger.info('DSR: Populated missing resource email', { 
            resourceAssigned: assignment.resourceAssigned, 
            resourceEmail 
          });
        }
      }

      // Process notification users - fix invalid email addresses
      const notificationUsers = JSON.parse(assignment.resource_assignment_notification_users || '[]');
      const fixedNotificationUsers = this.fixNotificationUserEmails(notificationUsers, users);
      
      if (JSON.stringify(fixedNotificationUsers) !== JSON.stringify(notificationUsers)) {
        updates.resource_assignment_notification_users = JSON.stringify(fixedNotificationUsers);
        needsUpdate = true;
        logger.info('DSR: Fixed notification user emails', { 
          original: notificationUsers.length,
          fixed: fixedNotificationUsers.length 
        });
      }

      // Update assignment if needed
      if (needsUpdate && assignment.id) {
        await db.updateAssignment(assignment.id, updates);
        logger.info('DSR: Updated assignment with missing emails', { 
          assignmentId: assignment.id,
          updates: Object.keys(updates)
        });
      }

      // Return processed assignment with all emails populated
      return {
        ...assignment,
        ...updates
      };
    } catch (error) {
      logger.error('Error processing assignment emails', { 
        assignmentId: assignment.id,
        error: error.message 
      });
      return assignment; // Return original if processing fails
    }
  }

  /**
   * Extract email from name or "Name <email>" format
   */
  static extractEmailFromField(field, users) {
    if (!field) return null;

    // Check if already in "Name <email>" format
    const emailMatch = field.match(/<([^>]+)>/);
    if (emailMatch) {
      return emailMatch[1];
    }

    // Look up user by name (preserve original capitalization)
    const user = users.find(u => u.name.toLowerCase() === field.toLowerCase());
    return user ? user.email : null;
  }

  /**
   * Extract email from resource field (may contain multiple resources)
   */
  static extractEmailFromResourceField(resourceField, users) {
    if (!resourceField) return null;

    // Handle comma-separated resources - take first one for primary email
    const firstResource = resourceField.split(',')[0].trim();
    return this.extractEmailFromField(firstResource, users);
  }

  /**
   * Fix notification user emails that contain names instead of actual emails
   */
  static fixNotificationUserEmails(notificationUsers, users) {
    return notificationUsers.map(user => {
      // If email field contains a name instead of email, look up actual email
      if (user.email && !user.email.includes('@')) {
        const foundUser = users.find(u => 
          u.name.toLowerCase() === user.email.toLowerCase() ||
          u.name.toLowerCase() === user.name.toLowerCase()
        );
        
        if (foundUser) {
          return {
            name: user.name,
            email: foundUser.email
          };
        }
      }
      
      // If no email but have name, look up by name
      if (!user.email && user.name) {
        const foundUser = users.find(u => u.name.toLowerCase() === user.name.toLowerCase());
        if (foundUser) {
          return {
            name: user.name,
            email: foundUser.email
          };
        }
      }

      return user;
    }).filter(user => user.email && user.email.includes('@')); // Only keep valid emails
  }

  /**
   * Process user fields during assignment creation/update
   * Converts names to "Name <email>" format for storage
   */
  static async processUserFields(am, pm, resourceAssigned, notificationUsers = []) {
    try {
      const users = await db.getAllUsers();
      const processed = {};

      // Process AM (preserve original capitalization)
      if (am) {
        const amUser = users.find(u => u.name.toLowerCase() === am.toLowerCase());
        processed.am = amUser ? amUser.name : am; // Use database name to preserve capitalization
        processed.am_email = amUser ? amUser.email : '';
      }

      // Process PM (preserve original capitalization)
      if (pm) {
        const pmUser = users.find(u => u.name.toLowerCase() === pm.toLowerCase());
        processed.pm = pmUser ? pmUser.name : pm; // Use database name to preserve capitalization
        processed.pm_email = pmUser ? pmUser.email : '';
      }

      // Process Resource Assigned
      if (resourceAssigned) {
        const resourceNames = resourceAssigned.split(',').map(r => r.trim());
        const processedResources = resourceNames.map(name => {
          const user = users.find(u => u.name.toLowerCase() === name.toLowerCase());
          return user ? `${user.name} <${user.email}>` : name; // Use database name for proper capitalization
        });
        
        processed.resourceAssigned = processedResources.join(', ');
        
        // Set primary resource email (first resource)
        const firstResourceUser = users.find(u => 
          u.name.toLowerCase() === resourceNames[0].toLowerCase()
        );
        processed.resource_assigned_email = firstResourceUser ? firstResourceUser.email : '';
      }

      // Process notification users
      const processedNotificationUsers = notificationUsers.map(user => {
        if (typeof user === 'string') {
          // Handle string format (preserve database capitalization)
          const foundUser = users.find(u => u.name.toLowerCase() === user.toLowerCase());
          return foundUser ? { name: foundUser.name, email: foundUser.email } : null;
        } else if (user.name) {
          // Handle object format (preserve database capitalization)
          const foundUser = users.find(u => u.name.toLowerCase() === user.name.toLowerCase());
          return foundUser ? { name: foundUser.name, email: foundUser.email } : user;
        }
        return user;
      }).filter(Boolean);

      processed.resource_assignment_notification_users = JSON.stringify(processedNotificationUsers);

      logger.info('DSR: Processed user fields for assignment', {
        amEmail: processed.am_email || 'missing',
        pmEmail: processed.pm_email || 'missing', 
        resourceEmail: processed.resource_assigned_email || 'missing',
        notificationUsers: processedNotificationUsers.length
      });

      return processed;
    } catch (error) {
      logger.error('Error processing user fields', { error: error.message });
      return {};
    }
  }
}