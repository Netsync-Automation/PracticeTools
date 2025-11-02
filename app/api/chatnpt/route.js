import { NextResponse } from 'next/server';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { getTableName } from '../../../lib/dynamodb';

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

function formatTimestamp(timestamp) {
  const parts = timestamp.split(':');
  const hours = parseInt(parts[0]);
  const minutes = parseInt(parts[1]);
  const seconds = parseInt(parts[2]);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function parseVTTTranscript(vttText) {
  const chunks = [];
  const lines = vttText.split('\n');
  let currentTimestamp = null;
  let currentText = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.match(/^\d{2}:\d{2}:\d{2}/)) {
      if (currentTimestamp && currentText.length > 0) {
        chunks.push({ timestamp: currentTimestamp, text: currentText.join(' ') });
      }
      currentTimestamp = line.split(' --> ')[0];
      currentText = [];
    } else if (line && !line.startsWith('WEBVTT') && !line.match(/^\d+$/)) {
      currentText.push(line);
    }
  }
  if (currentTimestamp && currentText.length > 0) {
    chunks.push({ timestamp: currentTimestamp, text: currentText.join(' ') });
  }
  return chunks;
}

export async function POST(request) {
  try {
    const { question } = await request.json();
    
    if (!question?.trim()) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    // Fetch Webex Recordings
    const recordingsTable = getTableName('WebexMeetingsRecordings');
    const recordingsResult = await docClient.send(new ScanCommand({
      TableName: recordingsTable,
      FilterExpression: 'approved = :approved AND attribute_exists(transcriptText)',
      ExpressionAttributeValues: { ':approved': true }
    }));
    const recordings = recordingsResult.Items || [];

    // Fetch Webex Messages
    const messagesTable = getTableName('WebexMessages');
    const messagesResult = await docClient.send(new ScanCommand({ TableName: messagesTable }));
    const messages = messagesResult.Items || [];

    // Fetch Documentation
    const docsTable = getTableName('Documentation');
    const docsResult = await docClient.send(new ScanCommand({ TableName: docsTable }));
    const docs = docsResult.Items || [];

    if (recordings.length === 0 && messages.length === 0 && docs.length === 0) {
      return NextResponse.json({ 
        answer: 'No data sources are currently available. Please check back later.',
        sources: []
      });
    }

    // Parse transcripts into timestamped chunks
    const chunksWithMetadata = [];
    recordings.forEach(rec => {
      const chunks = parseVTTTranscript(rec.transcriptText);
      chunks.forEach(chunk => {
        chunksWithMetadata.push({
          source: 'Webex Recordings',
          recordingId: rec.id,
          topic: rec.topic,
          timestamp: chunk.timestamp,
          text: chunk.text,
          downloadUrl: rec.downloadUrl || rec.s3Url,
          createTime: rec.createTime,
          hostEmail: rec.hostEmail
        });
      });
    });

    // Add Webex Messages
    messages.forEach(msg => {
      chunksWithMetadata.push({
        source: 'Webex Messages',
        messageId: msg.message_id,
        topic: `Message from ${msg.person_email}`,
        text: msg.text,
        created: msg.created,
        personEmail: msg.person_email
      });
      
      // Add attachment text if available
      msg.attachments?.forEach(att => {
        if (att.extractedText) {
          chunksWithMetadata.push({
            source: 'Webex Messages',
            messageId: msg.message_id,
            topic: `Attachment: ${att.fileName}`,
            text: att.extractedText,
            created: msg.created,
            personEmail: msg.person_email
          });
        }
      });
    });

    // Add Documentation
    docs.forEach(doc => {
      chunksWithMetadata.push({
        source: 'Documentation',
        docId: doc.id,
        topic: doc.fileName,
        text: doc.extractedText || `Document: ${doc.fileName}`,
        uploadedAt: doc.uploadedAt,
        uploadedBy: doc.uploadedBy
      });
    });

    // Build context with chunk references
    const context = chunksWithMetadata.map((chunk, idx) => 
      `[Chunk ${idx}|${chunk.source}|${chunk.topic}${chunk.timestamp ? '|' + chunk.timestamp : ''}]\n${chunk.text}`
    ).join('\n\n');

    const prompt = `You are a helpful AI assistant for Netsync Practice Tools. Answer the question based ONLY on the provided data from Webex Recordings, Webex Messages, and Documentation. Each chunk has a reference [Chunk ID|Source|Topic|Timestamp].

When answering, cite specific chunks by their ID numbers (e.g., "According to Chunk 5...").

Data chunks:
${context}

Question: ${question}

Answer (include chunk IDs in your response):`;

    const modelId = 'anthropic.claude-3-5-sonnet-20240620-v1:0';
    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    };

    const bedrockCommand = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload)
    });

    const bedrockResponse = await bedrockClient.send(bedrockCommand);
    const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
    const answer = responseBody.content[0].text;

    // Extract chunk IDs from answer
    const chunkMatches = answer.match(/Chunk \d+/g) || [];
    const citedChunkIds = [...new Set(chunkMatches.map(m => parseInt(m.split(' ')[1])))];
    
    // Build sources from cited chunks
    const sources = citedChunkIds
      .filter(id => id < chunksWithMetadata.length)
      .map(id => {
        const chunk = chunksWithMetadata[id];
        const base = {
          source: chunk.source,
          topic: chunk.topic,
          text: chunk.text
        };
        
        if (chunk.source === 'Webex Recordings') {
          return {
            ...base,
            recordingId: chunk.recordingId,
            timestamp: chunk.timestamp,
            downloadUrl: chunk.downloadUrl,
            date: chunk.createTime,
            viewUrl: `/company-education/webex-recordings`
          };
        } else if (chunk.source === 'Webex Messages') {
          return {
            ...base,
            messageId: chunk.messageId,
            date: chunk.created,
            personEmail: chunk.personEmail,
            viewUrl: `/company-education/webex-messages`
          };
        } else {
          return {
            ...base,
            docId: chunk.docId,
            date: chunk.uploadedAt,
            uploadedBy: chunk.uploadedBy,
            viewUrl: `/company-education/documentation`
          };
        }
      });

    return NextResponse.json({ answer, sources });
  } catch (error) {
    console.error('ChatNPT error:', error);
    return NextResponse.json({ 
      error: 'Failed to process question. Please try again.' 
    }, { status: 500 });
  }
}
