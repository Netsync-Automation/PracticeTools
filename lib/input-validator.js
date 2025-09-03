// Input validation and sanitization utilities
export function sanitizeInput(input, maxLength = 1000) {
  if (typeof input !== 'string') {
    input = String(input);
  }
  
  return input
    .trim()
    .substring(0, maxLength)
    .replace(/[<>]/g, '') // Remove potential XSS characters
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
}

export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

export function validateIssueTitle(title) {
  const sanitized = sanitizeInput(title, 100);
  return {
    isValid: sanitized.length >= 3 && sanitized.length <= 100,
    sanitized,
    errors: sanitized.length < 3 ? ['Title must be at least 3 characters'] : 
            sanitized.length > 100 ? ['Title must be less than 100 characters'] : []
  };
}

export function validateIssueDescription(description) {
  const sanitized = sanitizeInput(description, 1000);
  return {
    isValid: sanitized.length >= 10 && sanitized.length <= 1000,
    sanitized,
    errors: sanitized.length < 10 ? ['Description must be at least 10 characters'] : 
            sanitized.length > 1000 ? ['Description must be less than 1000 characters'] : []
  };
}

export function validateUrl(url) {
  if (!url) return { isValid: true, sanitized: '' };
  
  try {
    const parsed = new URL(url);
    const isValid = ['http:', 'https:'].includes(parsed.protocol);
    return {
      isValid,
      sanitized: isValid ? url : '',
      errors: isValid ? [] : ['URL must use HTTP or HTTPS protocol']
    };
  } catch {
    return {
      isValid: false,
      sanitized: '',
      errors: ['Invalid URL format']
    };
  }
}

export function validateComment(comment) {
  const sanitized = sanitizeInput(comment, 2000);
  return {
    isValid: sanitized.length >= 1 && sanitized.length <= 2000,
    sanitized,
    errors: sanitized.length < 1 ? ['Comment cannot be empty'] : 
            sanitized.length > 2000 ? ['Comment must be less than 2000 characters'] : []
  };
}