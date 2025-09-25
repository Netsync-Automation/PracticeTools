import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';

console.log('🚀 [STARTUP] Server initialization starting...');
console.log('🚀 [STARTUP] Environment variables:');
console.log('  - NODE_ENV:', process.env.NODE_ENV);
console.log('  - ENVIRONMENT:', process.env.ENVIRONMENT);
console.log('  - PORT:', process.env.PORT);
console.log('  - NEXTAUTH_URL:', process.env.NEXTAUTH_URL ? 'SET' : 'NOT SET');

const dev = process.env.NODE_ENV !== 'production' && process.env.ENVIRONMENT !== 'prod';
const hostname = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
const port = process.env.PORT || 3000;

console.log('🚀 [STARTUP] Next.js dev mode:', dev);
console.log('🚀 [STARTUP] Server will listen on:', `${hostname}:${port}`);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

console.log('🚀 [STARTUP] Next.js app created, preparing...');

app.prepare().then(() => {
  console.log('✅ [STARTUP] Next.js app prepared successfully');
  
  // Initialize email processing after Next.js is ready
  import('./lib/startup-init.js').then(() => {
    console.log('✅ [STARTUP] Email processing initialized');
  }).catch(error => {
    console.error('❌ [STARTUP] Failed to initialize email processing:', error);
  });

  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  })
  .once('error', (err) => {
    console.error('❌ [STARTUP] Server error:', err);
    console.error('❌ [STARTUP] Stack trace:', err.stack);
    process.exit(1);
  })
  .listen(port, () => {
    console.log(`✅ [STARTUP] Server ready on http://${hostname}:${port}`);
    console.log('✅ [STARTUP] Application startup completed successfully');
    console.log('🔍 [DEBUG] Server listening details:');
    console.log('  - Hostname:', hostname);
    console.log('  - Port:', port);
    console.log('  - Dev mode:', dev);
    console.log('  - Process PID:', process.pid);
    console.log('  - Memory usage:', process.memoryUsage());
    
    // Test server responsiveness
    setTimeout(() => {
      console.log('🔍 [DEBUG] Server health check - still running after 5 seconds');
    }, 5000);
  });
}).catch(error => {
  console.error('❌ [STARTUP] Next.js preparation failed:', error);
  console.error('❌ [STARTUP] Stack trace:', error.stack);
  process.exit(1);
});