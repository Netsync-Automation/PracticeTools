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

    const tableName = getTableName('WebexMeetingsRecordings');
    const command = new ScanCommand({
      TableName: tableName,
      FilterExpression: 'approved = :approved AND attribute_exists(transcriptText)',
      ExpressionAttributeValues: {
        ':approved': true
      }
    });
    
    const result = await docClient.send(command);
    const recordings = result.Items || [];

    if (recordings.length === 0) {
      return NextResponse.json({ 
        answer: 'No approved recordings with transcripts are currently available. Please check back later.',
        sources: []
      });
    }

    // Parse transcripts into timestamped chunks
    const chunksWithMetadata = [];
    recordings.forEach(rec => {
      const chunks = parseVTTTranscript(rec.transcriptText);
      chunks.forEach(chunk => {
        chunksWithMetadata.push({
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

    // Build context with chunk references
    const context = chunksWithMetadata.map((chunk, idx) => 
      `[Chunk ${idx}|${chunk.topic}|${chunk.timestamp}]\n${chunk.text}`
    ).join('\n\n');

    const prompt = `You are a helpful AI assistant for Netsync Practice Tools. Answer the question based ONLY on the provided WebEx meeting transcript chunks. Each chunk has a reference [Chunk ID|Topic|Timestamp].

When answering, cite specific chunks by their ID numbers (e.g., "According to Chunk 5...").

Transcript chunks:
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
        return {
          recordingId: chunk.recordingId,
          topic: chunk.topic,
          timestamp: chunk.timestamp,
          downloadUrl: chunk.downloadUrl,
          date: chunk.createTime,
          text: chunk.text
        };
      });

    return NextResponse.json({ answer, sources });
  } catch (error) {
    console.error('ChatNPT error:', error);
    return NextResponse.json({ 
      error: 'Failed to process question. Please try again.' 
    }, { status: 500 });
  }
}
