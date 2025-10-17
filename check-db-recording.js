import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getTableName } from './lib/dynamodb.js';

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function checkDatabaseRecording() {
  try {
    const tableName = getTableName('webex_meetings');
    const response = await docClient.send(new ScanCommand({ TableName: tableName }));
    
    const meetings = response.Items || [];
    console.log(`Found ${meetings.length} meetings in database:`);
    
    meetings.forEach(meeting => {
      console.log(`\nMeeting ID: ${meeting.meetingId}`);
      console.log(`Host: ${meeting.host}`);
      console.log(`Has recordingData: ${!!meeting.recordingData}`);
      
      if (meeting.recordingData) {
        const buffer = Buffer.from(meeting.recordingData, 'base64');
        console.log(`Recording size: ${buffer.length} bytes`);
        
        // Check file signature
        if (buffer.length >= 12) {
          const signature = buffer.subarray(0, 12);
          const hex = signature.toString('hex');
          console.log(`File signature (hex): ${hex}`);
          
          // Check for common video formats
          if (hex.startsWith('00000018') || hex.startsWith('00000020')) {
            console.log('Format: MP4');
          } else if (hex.startsWith('464c5601')) {
            console.log('Format: FLV');
          } else if (hex.startsWith('1a45dfa3')) {
            console.log('Format: WebM');
          } else if (hex.startsWith('52494646')) {
            console.log('Format: AVI');
          } else {
            console.log('Format: Unknown');
          }
        }
      }
      
      console.log(`Has recordingUrl: ${!!meeting.recordingUrl}`);
      if (meeting.recordingUrl) {
        console.log(`Recording URL: ${meeting.recordingUrl}`);
      }
    });
  } catch (error) {
    console.error('Error checking database:', error);
  }
}

checkDatabaseRecording();