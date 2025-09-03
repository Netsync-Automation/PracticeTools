import crypto from 'crypto';

const CSRF_SECRET = process.env.CSRF_SECRET || 'default-csrf-secret-change-me';

export function generateCSRFToken(sessionId) {
  const timestamp = Date.now().toString();
  const data = `${sessionId}:${timestamp}`;
  const hash = crypto.createHmac('sha256', CSRF_SECRET).update(data).digest('hex');
  return `${timestamp}.${hash}`;
}

export function validateCSRFToken(token, sessionId) {
  if (!token || !sessionId) return false;
  
  try {
    const [timestamp, hash] = token.split('.');
    if (!timestamp || !hash) return false;
    
    // Check if token is not older than 1 hour
    const tokenAge = Date.now() - parseInt(timestamp);
    if (tokenAge > 3600000) return false;
    
    const data = `${sessionId}:${timestamp}`;
    const expectedHash = crypto.createHmac('sha256', CSRF_SECRET).update(data).digest('hex');
    
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
  } catch (error) {
    return false;
  }
}

export function getCSRFMiddleware() {
  return (req, res, next) => {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      const token = req.headers['x-csrf-token'] || req.body._csrf;
      const sessionId = req.cookies?.['user-session']?.value || 'anonymous';
      
      if (!validateCSRFToken(token, sessionId)) {
        return res.status(403).json({ error: 'Invalid CSRF token' });
      }
    }
    next();
  };
}