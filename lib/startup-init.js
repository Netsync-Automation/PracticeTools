import { getEmailProcessor } from './email-processor.js';
import { logger } from './safe-logger.js';

// Initialize email processing on startup
export function initializeEmailProcessing() {
  try {
    logger.info('Initializing email processing on startup');
    
    // Get the email processor instance and start periodic processing
    const emailProcessor = getEmailProcessor();
    
    // Start processing every 5 minutes
    emailProcessor.startPeriodicProcessing(5);
    
    logger.info('Email processing initialized successfully - checking every 5 minutes');
  } catch (error) {
    logger.error('Failed to initialize email processing', { error: error.message });
  }
}

// Auto-initialize when this module is imported
initializeEmailProcessing();