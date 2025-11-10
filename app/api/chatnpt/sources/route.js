import { NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getTableName } from '../../../../lib/dynamodb';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export async function GET() {
  try {
    const sources = [];

    // Check Webex Recordings
    const recordingsTable = getTableName('WebexMeetingsRecordings');
    const recordingsResult = await docClient.send(new ScanCommand({
      TableName: recordingsTable,
      FilterExpression: 'approved = :approved AND attribute_exists(transcriptText)',
      ExpressionAttributeValues: { ':approved': true },
      Select: 'COUNT'
    }));
    
    if (recordingsResult.Count > 0) {
      sources.push({
        name: 'Meeting Recordings',
        description: 'Approved WebEx meeting recordings with transcripts',
        path: 'Practice Tools > Company Education > WebEx Recordings',
        url: '/company-education/webex-recordings',
        count: recordingsResult.Count,
        icon: 'video',
        type: 'Webex Recordings'
      });
    }

    // Check Webex Messages
    const messagesTable = getTableName('WebexMessages');
    const messagesResult = await docClient.send(new ScanCommand({
      TableName: messagesTable,
      Select: 'COUNT'
    }));
    
    if (messagesResult.Count > 0) {
      sources.push({
        name: 'Team Messages',
        description: 'Messages from monitored WebEx team spaces',
        path: 'Practice Tools > Company Education > WebEx Messages',
        url: '/company-education/webex-messages',
        count: messagesResult.Count,
        icon: 'chat',
        type: 'Webex Messages'
      });
    }

    // Check Documentation
    const docsTable = getTableName('Documentation');
    const docsResult = await docClient.send(new ScanCommand({
      TableName: docsTable,
      Select: 'COUNT'
    }));
    
    if (docsResult.Count > 0) {
      sources.push({
        name: 'Documentation',
        description: 'Uploaded training documents and resources',
        path: 'Practice Tools > Company Education > Documentation',
        url: '/company-education/documentation',
        count: docsResult.Count,
        icon: 'document',
        type: 'Documentation'
      });
    }

    return NextResponse.json({ sources });
  } catch (error) {
    console.error('Error fetching data sources:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
