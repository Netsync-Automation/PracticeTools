import { NextResponse } from 'next/server';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { createOpenSearchClient } from '../../../../lib/opensearch-setup.js';

const bedrockClient = new BedrockRuntimeClient({ region: 'us-east-1' });

export async function POST(request) {
  try {
    const { question, tenantId = 'default', maxResults = 5 } = await request.json();
    
    if (!question) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }
    
    // Generate embedding for the question
    const questionEmbedding = await generateEmbedding(question);
    
    // Search for relevant document chunks
    const relevantChunks = await searchDocuments(questionEmbedding, tenantId, maxResults);
    
    if (relevantChunks.length === 0) {
      return NextResponse.json({
        answer: "I couldn't find any relevant information in the documents to answer your question.",
        sources: []
      });
    }
    
    // Generate answer using Claude with retrieved context
    const answer = await generateAnswer(question, relevantChunks);
    
    return NextResponse.json({
      answer,
      sources: relevantChunks.map(chunk => ({
        documentId: chunk.documentId,
        s3Key: chunk.s3Key,
        text: chunk.text.substring(0, 200) + '...',
        score: chunk.score
      }))
    });
    
  } catch (error) {
    console.error('Error processing query:', error);
    return NextResponse.json({ error: 'Failed to process query' }, { status: 500 });
  }
}

async function generateEmbedding(text) {
  const params = {
    modelId: 'amazon.titan-embed-text-v1',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      inputText: text
    })
  };
  
  const command = new InvokeModelCommand(params);
  const result = await bedrockClient.send(command);
  const response = JSON.parse(new TextDecoder().decode(result.body));
  return response.embedding;
}

async function searchDocuments(embedding, tenantId, maxResults) {
  const opensearchClient = createOpenSearchClient();
  
  const searchQuery = {
    size: maxResults,
    query: {
      bool: {
        must: [
          {
            knn: {
              vector: {
                vector: embedding,
                k: maxResults
              }
            }
          }
        ],
        filter: [
          {
            term: {
              tenantId: tenantId
            }
          }
        ]
      }
    },
    _source: ['documentId', 'chunkIndex', 'text', 's3Key', 'tenantId']
  };
  
  const response = await opensearchClient.search({
    index: 'document-vectors',
    body: searchQuery
  });
  
  return response.body.hits.hits.map(hit => ({
    ...hit._source,
    score: hit._score
  }));
}

async function generateAnswer(question, relevantChunks) {
  const context = relevantChunks.map(chunk => chunk.text).join('\n\n');
  
  const prompt = `Human: Based on the following document excerpts, please answer the question. If the information is not available in the provided context, say so.

Context:
${context}

Question: ${question}

Assistant:`;

  const params = {
    modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })
  };
  
  const command = new InvokeModelCommand(params);
  const result = await bedrockClient.send(command);
  const response = JSON.parse(new TextDecoder().decode(result.body));
  return response.content[0].text;
}