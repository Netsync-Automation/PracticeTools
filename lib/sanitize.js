/**
 * Sanitize text input - React provides XSS protection by default
 * @param {string} text - Text to sanitize
 * @returns {string} - Sanitized text
 */
export function sanitizeText(text) {
  if (typeof text !== 'string') {
    return '';
  }
  
  // Only trim whitespace - React handles XSS protection automatically
  return text.trim();
}

/**
 * Safely parse JSON with fallback
 * @param {string} jsonString - JSON string to parse
 * @param {any} fallback - Fallback value if parsing fails
 * @returns {any} - Parsed JSON or fallback
 */
export function safeJsonParse(jsonString, fallback = null) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return fallback;
  }
}