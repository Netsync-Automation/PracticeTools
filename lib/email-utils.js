/**
 * Email Normalization Utility
 * DSR Compliance: Centralized email handling to prevent case-sensitivity issues
 */

/**
 * Normalizes an email address to lowercase for consistent comparisons
 * @param {string} email - Email address to normalize
 * @returns {string} Normalized email in lowercase, or empty string if invalid
 */
export function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/**
 * Compares two email addresses in a case-insensitive manner
 * @param {string} email1 - First email address
 * @param {string} email2 - Second email address
 * @returns {boolean} True if emails match (case-insensitive)
 */
export function emailsMatch(email1, email2) {
  return normalizeEmail(email1) === normalizeEmail(email2);
}

/**
 * Checks if an email exists in an array (case-insensitive)
 * @param {string} email - Email to search for
 * @param {string[]} emailArray - Array of emails to search in
 * @returns {boolean} True if email exists in array
 */
export function emailInArray(email, emailArray) {
  if (!Array.isArray(emailArray)) return false;
  const normalized = normalizeEmail(email);
  return emailArray.some(e => normalizeEmail(e) === normalized);
}

/**
 * Finds a user by email in an array (case-insensitive)
 * @param {string} email - Email to search for
 * @param {Array} users - Array of user objects with email property
 * @returns {Object|undefined} User object if found
 */
export function findUserByEmail(email, users) {
  if (!Array.isArray(users)) return undefined;
  const normalized = normalizeEmail(email);
  return users.find(u => normalizeEmail(u.email) === normalized);
}

/**
 * Filters an array to exclude a specific email (case-insensitive)
 * @param {string[]} emailArray - Array of emails
 * @param {string} emailToExclude - Email to exclude
 * @returns {string[]} Filtered array
 */
export function excludeEmail(emailArray, emailToExclude) {
  if (!Array.isArray(emailArray)) return [];
  const normalized = normalizeEmail(emailToExclude);
  return emailArray.filter(e => normalizeEmail(e) !== normalized);
}
