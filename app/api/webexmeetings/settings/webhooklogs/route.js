import { NextResponse } from 'next/server';
import { getTableName } from '../../../../../lib/dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export async function GET() {
  try {
    console.log('📊 [WEBHOOK-LOGS] Fetching webhook logs...');
    
    // Get webhook logs from DynamoDB
    const tableName = getTableName('WebexMeetingsWebhookLogs');
    
    const scanCommand = new ScanCommand({
      TableName: tableName,
      Limit: 100, // Limit to last 100 logs
      ScanIndexForward: false // Get newest first
    });
    
    let logs = [];
    try {
      const result = await docClient.send(scanCommand);
      logs = result.Items || [];
      console.log('📊 [WEBHOOK-LOGS] Found', logs.length, 'webhook logs');
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        console.log('📊 [WEBHOOK-LOGS] Webhook logs table does not exist yet');
        logs = [];
      } else {
        throw error;
      }
    }
    
    // Sort by timestamp descending (newest first)
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Format logs for display
    const formattedLogs = logs.map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      webhookType: log.webhookType,
      siteUrl: log.siteUrl,
      meetingId: log.meetingId,
      messageId: log.messageId,
      status: log.status,
      message: log.message,
      error: log.error,
      processingDetails: log.processingDetails,
      databaseAction: log.databaseAction,
      s3Upload: log.s3Upload,
      sseNotification: log.sseNotification,
      trace: log.trace
    }));
    
    console.log('📊 [WEBHOOK-LOGS] Returning', formattedLogs.length, 'formatted logs');
    
    return NextResponse.json({
      success: true,
      logs: formattedLogs,
      totalCount: formattedLogs.length
    });
    
  } catch (error) {
    console.error('📊 [WEBHOOK-LOGS] Error fetching webhook logs:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch webhook logs',
      logs: []
    }, { status: 500 });
  }
}