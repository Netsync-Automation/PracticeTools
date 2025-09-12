import crypto from 'crypto';

export function validateCSRFToken(token, secret) {
  if (!token || !secret) return false;
  
  try {
    const [timestamp, hash] = token.split('.');
    if (!timestamp || !hash) return false;
    
    // Check if token is expired (15 minutes)
    const tokenTime = parseInt(timestamp);
    const now = Date.now();
    if (now - tokenTime > 15 * 60 * 1000) return false;
    
    // Verify hash
    const expectedHash = crypto.createHmac('sha256', secret)
      .update(timestamp)
      .digest('hex');
    
    return hash === expectedHash;
  } catch (error) {
    return false;
  }
}