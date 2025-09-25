import crypto from 'crypto';

// DSR: Industry-standard CSRF token generation with HMAC and expiration
export function generateCSRFToken(secret) {
  if (!secret) throw new Error('CSRF secret required');
  
  const timestamp = Date.now().toString();
  const randomBytes = crypto.randomBytes(16).toString('hex');
  const payload = `${timestamp}.${randomBytes}`;
  
  const hash = crypto.createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return `${payload}.${hash}`;
}

// DSR: Secure CSRF token validation with proper HMAC verification
export function validateCSRFToken(token, secret, cookieToken = null) {
  if (!token || !secret) return false;
  
  try {
    // Double-submit cookie pattern validation
    if (cookieToken && token !== cookieToken) return false;
    
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    const [timestamp, randomBytes, hash] = parts;
    if (!timestamp || !randomBytes || !hash) return false;
    
    // Check expiration (30 minutes for better UX)
    const tokenTime = parseInt(timestamp);
    const now = Date.now();
    if (now - tokenTime > 30 * 60 * 1000) return false;
    
    // Verify HMAC
    const payload = `${timestamp}.${randomBytes}`;
    const expectedHash = crypto.createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    );
  } catch (error) {
    return false;
  }
}