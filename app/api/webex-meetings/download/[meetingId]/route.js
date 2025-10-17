import { NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getTableName } from '../../../../../lib/dynamodb';

export const dynamic = 'force-dynamic';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export async function GET(request, { params }) {
  try {
    const { meetingId } = params;
    console.log('[DOWNLOAD] Meeting ID:', meetingId);
    
    const tableName = getTableName('webex_meetings');
    console.log('[DOWNLOAD] Table name:', tableName);
    
    const response = await docClient.send(new GetCommand({
      TableName: tableName,
      Key: { meetingId }
    }));
    
    console.log('[DOWNLOAD] DynamoDB response:', !!response.Item);
    console.log('[DOWNLOAD] Has recording data:', !!response.Item?.recordingData);
    
    if (!response.Item) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }
    
    if (!response.Item.recordingData) {
      return NextResponse.json({ error: 'Recording data not available' }, { status: 404 });
    }
    
    const recordingBuffer = Buffer.from(response.Item.recordingData, 'base64');
    console.log('[DOWNLOAD] Buffer size:', recordingBuffer.length);
    
    // Detect content type from file signature
    let contentType = 'application/octet-stream';
    let extension = 'bin';
    
    if (recordingBuffer.length >= 8) {
      const signature = recordingBuffer.subarray(0, 8);
      const hex = signature.toString('hex');
      
      if (hex.startsWith('00000018') || hex.startsWith('00000020')) {
        contentType = 'video/mp4';
        extension = 'mp4';
      } else if (hex.startsWith('464c5601')) {
        contentType = 'video/x-flv';
        extension = 'flv';
      } else if (hex.startsWith('1a45dfa3')) {
        contentType = 'video/webm';
        extension = 'webm';
      } else {
        // Default to video for unknown formats
        contentType = 'video/mp4';
        extension = 'mp4';
      }
    }
    
    return new NextResponse(recordingBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="meeting-${meetingId}.${extension}"`,
        'Content-Length': recordingBuffer.length.toString()
      }
    });
  } catch (error) {
    console.error('[DOWNLOAD] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}