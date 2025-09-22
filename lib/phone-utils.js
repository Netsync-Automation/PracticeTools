import { parsePhoneNumber, isValidPhoneNumber, getCountries, getCountryCallingCode } from 'libphonenumber-js';

// Common country codes with their display names
export const COUNTRY_CODES = [
  { code: 'US', name: 'United States', callingCode: '+1' },
  { code: 'CA', name: 'Canada', callingCode: '+1' },
  { code: 'GB', name: 'United Kingdom', callingCode: '+44' },
  { code: 'AU', name: 'Australia', callingCode: '+61' },
  { code: 'DE', name: 'Germany', callingCode: '+49' },
  { code: 'FR', name: 'France', callingCode: '+33' },
  { code: 'JP', name: 'Japan', callingCode: '+81' },
  { code: 'CN', name: 'China', callingCode: '+86' },
  { code: 'IN', name: 'India', callingCode: '+91' },
  { code: 'BR', name: 'Brazil', callingCode: '+55' },
  { code: 'MX', name: 'Mexico', callingCode: '+52' },
  { code: 'IT', name: 'Italy', callingCode: '+39' },
  { code: 'ES', name: 'Spain', callingCode: '+34' },
  { code: 'NL', name: 'Netherlands', callingCode: '+31' },
  { code: 'SE', name: 'Sweden', callingCode: '+46' },
  { code: 'NO', name: 'Norway', callingCode: '+47' },
  { code: 'DK', name: 'Denmark', callingCode: '+45' },
  { code: 'FI', name: 'Finland', callingCode: '+358' },
  { code: 'CH', name: 'Switzerland', callingCode: '+41' },
  { code: 'AT', name: 'Austria', callingCode: '+43' }
];

/**
 * Validates a phone number for a specific country
 * @param {string} phoneNumber - The phone number to validate
 * @param {string} countryCode - The ISO country code (e.g., 'US')
 * @returns {Object} - { isValid: boolean, error?: string }
 */
export function validatePhoneNumber(phoneNumber, countryCode = 'US') {
  if (!phoneNumber || !phoneNumber.trim()) {
    return { isValid: false, error: 'Phone number is required' };
  }

  try {
    const isValid = isValidPhoneNumber(phoneNumber, countryCode);
    if (!isValid) {
      return { isValid: false, error: 'Invalid phone number format' };
    }
    return { isValid: true };
  } catch (error) {
    return { isValid: false, error: 'Invalid phone number format' };
  }
}

/**
 * Normalizes a phone number to E.164 format
 * @param {string} phoneNumber - The phone number to normalize
 * @param {string} countryCode - The ISO country code (e.g., 'US')
 * @returns {string|null} - The normalized phone number in E.164 format or null if invalid
 */
export function normalizePhoneNumber(phoneNumber, countryCode = 'US') {
  if (!phoneNumber || !phoneNumber.trim()) {
    return null;
  }

  try {
    const parsed = parsePhoneNumber(phoneNumber, countryCode);
    if (parsed && parsed.isValid()) {
      return parsed.format('E.164');
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Formats a phone number for display
 * @param {string} phoneNumber - The phone number (preferably in E.164 format)
 * @param {string} format - The format type ('NATIONAL' or 'INTERNATIONAL')
 * @returns {string} - The formatted phone number
 */
export function formatPhoneNumber(phoneNumber, format = 'NATIONAL') {
  if (!phoneNumber || !phoneNumber.trim()) {
    return '';
  }

  try {
    const parsed = parsePhoneNumber(phoneNumber);
    if (parsed && parsed.isValid()) {
      return parsed.format(format);
    }
    return phoneNumber; // Return original if parsing fails
  } catch (error) {
    return phoneNumber; // Return original if parsing fails
  }
}

/**
 * Creates a tel: link for phone numbers
 * @param {string} phoneNumber - The phone number (preferably in E.164 format)
 * @returns {string} - The tel: link
 */
export function createPhoneLink(phoneNumber) {
  if (!phoneNumber || !phoneNumber.trim()) {
    return '';
  }

  try {
    const parsed = parsePhoneNumber(phoneNumber);
    if (parsed && parsed.isValid()) {
      return `tel:${parsed.format('E.164')}`;
    }
    // Fallback: clean the number and create link
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');
    return `tel:${cleaned}`;
  } catch (error) {
    // Fallback: clean the number and create link
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');
    return `tel:${cleaned}`;
  }
}

/**
 * Gets the country code from a phone number
 * @param {string} phoneNumber - The phone number
 * @returns {string|null} - The country code or null if not found
 */
export function getCountryFromPhoneNumber(phoneNumber) {
  if (!phoneNumber || !phoneNumber.trim()) {
    return null;
  }

  try {
    const parsed = parsePhoneNumber(phoneNumber);
    if (parsed && parsed.isValid()) {
      return parsed.country;
    }
    return null;
  } catch (error) {
    return null;
  }
}