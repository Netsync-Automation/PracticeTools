import { getEmailProcessor } from './email-processor.js';
import { getTranscriptRetryProcessor } from './transcript-retry-processor.js';
import { logger } from './safe-logger.js';

export function initializeEmailProcessing() {
  try {
    logger.info('Initializing email processing on startup');
    const emailProcessor = getEmailProcessor();
    emailProcessor.startPeriodicProcessing(5);
    logger.info('Email processing initialized successfully - checking every 5 minutes');
  } catch (error) {
    logger.error('Failed to initialize email processing', { error: error.message });
  }
}

export function initializeTranscriptRetryProcessing() {
  try {
    logger.info('Initializing transcript retry processing on startup');
    const transcriptRetryProcessor = getTranscriptRetryProcessor();
    transcriptRetryProcessor.startPeriodicProcessing(5);
    logger.info('Transcript retry processing initialized successfully - checking every 5 minutes');
  } catch (error) {
    logger.error('Failed to initialize transcript retry processing', { error: error.message });
  }
}

initializeEmailProcessing();
initializeTranscriptRetryProcessing();