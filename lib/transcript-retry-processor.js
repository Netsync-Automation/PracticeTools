import { getTableName } from './dynamodb.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from './safe-logger.js';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export class TranscriptRetryProcessor {
  constructor() {
    this.isProcessing = false;
    this.lastProcessTime = null;
  }

  async processTranscriptRetries() {
    if (this.isProcessing) {
      logger.info('Transcript retry processing already in progress, skipping');
      return;
    }

    try {
      this.isProcessing = true;
      logger.info('Starting transcript retry processing');

      const tableName = getTableName('WebexMeetingsRecordings');
      
      const command = new ScanCommand({
        TableName: tableName
      });
      
      const result = await docClient.send(command);
      const recordings = result.Items || [];
      
      const now = Date.now();
      const recordingsWithoutTranscript = recordings.filter(r => !r.transcriptText && !r.transcriptFailed);
      
      logger.info('Recordings without transcript', { 
        total: recordings.length,
        withoutTranscript: recordingsWithoutTranscript.length,
        sample: recordingsWithoutTranscript.slice(0, 3).map(r => ({
          id: r.id,
          meetingId: r.meetingId,
          hasNextRetry: !!r.nextTranscriptRetry,
          nextRetry: r.nextTranscriptRetry,
          retryCount: r.transcriptRetryCount || 0
        }))
      });
      
      const recordingsToRetry = recordingsWithoutTranscript.filter(r => {
        if (!r.nextTranscriptRetry) return true;
        const nextRetryTime = new Date(r.nextTranscriptRetry).getTime();
        const shouldRetry = nextRetryTime <= now;
        return shouldRetry;
      });
      
      logger.info('Found recordings to retry', { 
        count: recordingsToRetry.length,
        now: new Date(now).toISOString()
      });
      
      for (const recording of recordingsToRetry) {
        try {
          const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
          const response = await fetch(`${baseUrl}/api/webexmeetings/recordings/${recording.id}/transcript`, {
            method: 'POST'
          });
          
          const responseData = await response.json();
          
          logger.info('Transcript retry attempt', { 
            recordingId: recording.id, 
            success: response.ok,
            status: response.status,
            message: responseData.message || responseData.error,
            retryCount: recording.transcriptRetryCount || 0
          });
        } catch (error) {
          logger.error('Transcript retry failed', { 
            recordingId: recording.id, 
            error: error.message 
          });
        }
      }
      
      this.lastProcessTime = new Date();
      logger.info('Transcript retry processing completed');

    } catch (error) {
      logger.error('Transcript retry processing failed', { error: error.message });
    } finally {
      this.isProcessing = false;
    }
  }

  startPeriodicProcessing(intervalMinutes = 5) {
    logger.info('Starting periodic transcript retry processing', { intervalMinutes });
    
    this.processTranscriptRetries();
    
    setInterval(() => {
      this.processTranscriptRetries();
    }, intervalMinutes * 60 * 1000);
  }
}

let transcriptRetryProcessorInstance = null;

export function getTranscriptRetryProcessor() {
  if (!transcriptRetryProcessorInstance) {
    transcriptRetryProcessorInstance = new TranscriptRetryProcessor();
  }
  return transcriptRetryProcessorInstance;
}
