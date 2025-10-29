import { NextResponse } from 'next/server';
import { getTableName } from '../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tableName = getTableName('WebexMeetingsRecordings');
    
    const command = new ScanCommand({
      TableName: tableName
    });
    
    const result = await docClient.send(command);
    const recordings = result.Items || [];
    
    const now = Date.now();
    const recordingsToRetry = recordings.filter(r => {
      if (r.transcriptText) return false;
      if (!r.nextTranscriptRetry) return true;
      return new Date(r.nextTranscriptRetry).getTime() <= now;
    });
    
    const retryPromises = recordingsToRetry.map(async (recording) => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get('host')}`;
        const response = await fetch(`${baseUrl}/api/webexmeetings/recordings/${recording.id}/transcript`, {
          method: 'POST'
        });
        return { id: recording.id, success: response.ok };
      } catch (error) {
        return { id: recording.id, success: false, error: error.message };
      }
    });
    
    const results = await Promise.all(retryPromises);
    
    return NextResponse.json({ 
      success: true, 
      processed: results.length,
      results 
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process transcript retries' }, { status: 500 });
  }
}
