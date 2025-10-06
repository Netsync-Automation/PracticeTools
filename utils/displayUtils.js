// DSR: Utility functions for consistent display formatting

/**
 * Extract display name from "Name <email>" format
 * @param {string} nameWithEmail - String in format "Name <email>" or just "Name"
 * @returns {string} - Just the name part
 */
export function extractDisplayName(nameWithEmail) {
  if (!nameWithEmail) return '';
  
  // Check if it contains email format "Name <email>"
  const emailMatch = nameWithEmail.match(/^(.+?)\s*<[^>]+>$/);
  if (emailMatch) {
    return emailMatch[1].trim();
  }
  
  // Return as-is if no email format detected
  return nameWithEmail.trim();
}

/**
 * Extract multiple display names from comma or pipe-separated "Name <email>" format
 * @param {string} namesWithEmails - Comma or pipe-separated string of "Name <email>" entries
 * @returns {string} - Comma-separated names only
 */
export function extractDisplayNames(namesWithEmails) {
  if (!namesWithEmails) return '';
  
  // Handle both comma and pipe separators
  return namesWithEmails
    .split(/[,|]/)
    .map(name => extractDisplayName(name))
    .filter(name => name) // Remove empty entries
    .join(', ');
}