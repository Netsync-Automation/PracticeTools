import { db } from './dynamodb.js';

/**
 * Access control utility for Leadership Question issues
 * Implements industry best practices for role-based access control
 */

/**
 * Check if user can access a Leadership Question issue
 * @param {Object} issue - The issue object
 * @param {Object} user - The user object
 * @returns {boolean} - Whether user has access
 */
export function canAccessLeadershipQuestion(issue, user) {
  // Admin users can access all issues
  if (user.isAdmin) {
    return true;
  }
  
  // Issue creator can always access their own issue
  if (issue.email === user.email) {
    return true;
  }
  
  // Only Leadership Question issues need special access control
  if (issue.issue_type !== 'Leadership Question') {
    return true;
  }
  
  // For Leadership Questions, check if user is practice leadership for the issue's practice
  if (issue.practice && user.practices && user.practices.includes(issue.practice)) {
    // User must be practice_manager or practice_principal for the specific practice
    return user.role === 'practice_manager' || user.role === 'practice_principal';
  }
  
  // Deny access by default for Leadership Questions
  return false;
}

/**
 * Filter issues array based on user access permissions
 * @param {Array} issues - Array of issues
 * @param {Object} user - The user object
 * @returns {Array} - Filtered issues array
 */
export function filterIssuesByAccess(issues, user) {
  return issues.filter(issue => canAccessLeadershipQuestion(issue, user));
}

/**
 * Validate user can perform action on issue
 * @param {Object} issue - The issue object
 * @param {Object} user - The user object
 * @param {string} action - The action being performed ('view', 'edit', 'comment', 'upvote')
 * @returns {Object} - Validation result with success boolean and error message
 */
export function validateIssueAccess(issue, user, action = 'view') {
  if (!canAccessLeadershipQuestion(issue, user)) {
    return {
      success: false,
      error: 'Access denied. Leadership Questions are only visible to the creator, practice leadership of the selected practice, and administrators.',
      statusCode: 403
    };
  }
  
  // Additional action-specific validations can be added here
  switch (action) {
    case 'edit':
      if (!user.isAdmin && issue.email !== user.email) {
        return {
          success: false,
          error: 'Only the issue creator or administrators can edit this issue.',
          statusCode: 403
        };
      }
      break;
    case 'comment':
    case 'upvote':
    case 'view':
      // Access already validated above
      break;
    default:
      return {
        success: false,
        error: 'Invalid action specified.',
        statusCode: 400
      };
  }
  
  return { success: true };
}