const AWS = require('aws-sdk');

const textract = new AWS.Textract();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const bedrock = new AWS.BedrockRuntime();
const { Client } = require('@opensearch-project/opensearch');
const { AwsSigv4Signer } = require('@opensearch-project/opensearch/aws');

// DSR Compliance: Environment-aware configuration
function getEnvironment() {
  return process.env.ENVIRONMENT || process.env.NODE_ENV || 'dev';
}

function getTableName(baseName) {
  const env = getEnvironment();
  return `PracticeTools-${env}-${baseName}`;
}

function getOpenSearchEndpoint() {
  const env = getEnvironment();
  // Environment-specific OpenSearch endpoints
  const endpoints = {
    dev: 'https://8st52hujhn4om815yz4l.us-east-1.aoss.amazonaws.com',
    prod: 'https://9nagbvhy3f5jrpqjoo6l.us-east-1.aoss.amazonaws.com'
  };
  return process.env.OPENSEARCH_ENDPOINT || endpoints[env] || endpoints.dev;
}

const CHUNKS_TABLE = getTableName('DocumentChunks');
const DOCUMENTATION_TABLE = getTableName('Documentation');
const OPENSEARCH_ENDPOINT = getOpenSearchEndpoint();

const opensearchClient = new Client({
  ...AwsSigv4Signer({
    region: 'us-east-1',
    service: 'aoss'
  }),
  node: OPENSEARCH_ENDPOINT
});

exports.handler = async (event) => {
  console.log('Processing document event:', JSON.stringify(event, null, 2));
  
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    
    try {
      await processDocument(bucket, key);
    } catch (error) {
      console.error(`Error processing ${key}:`, error);
      throw error;
    }
  }
  
  return { statusCode: 200, body: 'Documents processed successfully' };
};

async function processDocument(bucket, key) {
  console.log(`Processing document: s3://${bucket}/${key}`);
  
  const documentId = extractDocumentIdFromKey(key);
  const fileExtension = key.split('.').pop().toLowerCase();
  
  // Get document metadata including expiration date
  const documentMetadata = await getDocumentMetadata(documentId);
  
  try {
    let extractedText;
    
    if (['pdf', 'png', 'jpg', 'jpeg'].includes(fileExtension)) {
      extractedText = await extractTextWithTextract(bucket, key);
    } else if (['docx', 'doc'].includes(fileExtension)) {
      extractedText = await analyzeDocumentSync(bucket, key);
    } else if (fileExtension === 'txt') {
      extractedText = await readTextFile(bucket, key);
    } else {
      throw new Error(`Unsupported file type: ${fileExtension}`);
    }
    
    const chunks = chunkText(extractedText);
    
    await Promise.all(chunks.map((chunk, index) => 
      storeChunkWithEmbedding(documentId, key, chunk, index, documentMetadata)
    ));
    
    // Update Documentation table status to completed
    await updateDocumentStatus(documentId, 'completed');
    
    console.log(`Successfully processed ${chunks.length} chunks for ${key}`);
  } catch (error) {
    // Update Documentation table status to failed
    await updateDocumentStatus(documentId, 'failed');
    throw error;
  }
}

async function extractTextWithTextract(bucket, key) {
  const params = {
    DocumentLocation: {
      S3Object: {
        Bucket: bucket,
        Name: key
      }
    }
  };
  
  const startResult = await textract.startDocumentTextDetection(params).promise();
  const jobId = startResult.JobId;
  
  // Poll for completion
  let jobStatus = 'IN_PROGRESS';
  while (jobStatus === 'IN_PROGRESS') {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    
    const statusResult = await textract.getDocumentTextDetection({ JobId: jobId }).promise();
    jobStatus = statusResult.JobStatus;
    
    if (jobStatus === 'SUCCEEDED') {
      let extractedText = '';
      let nextToken = null;
      
      do {
        const params = { JobId: jobId };
        if (nextToken) params.NextToken = nextToken;
        
        const result = await textract.getDocumentTextDetection(params).promise();
        
        result.Blocks
          .filter(block => block.BlockType === 'LINE')
          .forEach(block => {
            extractedText += block.Text + '\n';
          });
        
        nextToken = result.NextToken;
      } while (nextToken);
      
      return extractedText;
    } else if (jobStatus === 'FAILED') {
      throw new Error('Textract job failed');
    }
  }
}

async function analyzeDocumentSync(bucket, key) {
  const params = {
    Document: {
      S3Object: {
        Bucket: bucket,
        Name: key
      }
    },
    FeatureTypes: ['TABLES', 'FORMS']
  };
  
  const result = await textract.analyzeDocument(params).promise();
  
  let extractedText = '';
  result.Blocks
    .filter(block => block.BlockType === 'LINE')
    .forEach(block => {
      extractedText += block.Text + '\n';
    });
  
  return extractedText;
}

async function readTextFile(bucket, key) {
  const s3 = new AWS.S3();
  const result = await s3.getObject({ Bucket: bucket, Key: key }).promise();
  return result.Body.toString('utf-8');
}

function chunkText(text, maxTokens = 500, overlap = 50) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const chunks = [];
  let currentChunk = '';
  let tokenCount = 0;
  
  for (const sentence of sentences) {
    const sentenceTokens = Math.ceil(sentence.length / 4); // Rough token estimate
    
    if (tokenCount + sentenceTokens > maxTokens && currentChunk) {
      chunks.push(currentChunk.trim());
      
      // Create overlap
      const words = currentChunk.split(' ');
      currentChunk = words.slice(-overlap).join(' ') + ' ';
      tokenCount = Math.ceil(currentChunk.length / 4);
    }
    
    currentChunk += sentence + '. ';
    tokenCount += sentenceTokens;
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

async function storeChunkWithEmbedding(documentId, s3Key, chunkText, chunkIndex, documentMetadata = {}) {
  // Generate embedding using Bedrock Titan
  const embedding = await generateEmbedding(chunkText);
  
  // Store in DynamoDB
  const chunkItem = {
    pk: `DOC#${documentId}`,
    sk: `CHUNK#${String(chunkIndex).padStart(5, '0')}`,
    documentId,
    s3Key,
    chunkIndex,
    extractedText: chunkText,
    tenantId: extractTenantFromKey(s3Key),
    createdAt: new Date().toISOString(),
    tokenCount: Math.ceil(chunkText.length / 4)
  };
  
  // Add expiration date if present
  if (documentMetadata.expirationDate) {
    chunkItem.expirationDate = documentMetadata.expirationDate;
  }
  
  await dynamodb.put({
    TableName: CHUNKS_TABLE,
    Item: chunkItem
  }).promise();
  
  // Store vector in OpenSearch
  const vectorBody = {
    documentId,
    chunkIndex,
    text: chunkText,
    vector: embedding,
    s3Key,
    tenantId: chunkItem.tenantId,
    createdAt: chunkItem.createdAt
  };
  
  // Add expiration date to vector if present
  if (documentMetadata.expirationDate) {
    vectorBody.expirationDate = documentMetadata.expirationDate;
  }
  
  await opensearchClient.index({
    index: 'document-vectors',
    id: `${documentId}-${chunkIndex}`,
    body: vectorBody
  });
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
  
  const result = await bedrock.invokeModel(params).promise();
  const response = JSON.parse(result.body.toString());
  return response.embedding;
}

function generateDocumentId(s3Key) {
  return s3Key.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
}

function extractDocumentIdFromKey(s3Key) {
  // Extract document ID from S3 key pattern: documentation/{id}/{filename}
  const parts = s3Key.split('/');
  return parts.length >= 2 ? parts[1] : generateDocumentId(s3Key);
}

async function updateDocumentStatus(documentId, status) {
  try {
    await dynamodb.update({
      TableName: DOCUMENTATION_TABLE,
      Key: { id: documentId },
      UpdateExpression: 'SET extractionStatus = :status, processedAt = :processedAt',
      ExpressionAttributeValues: {
        ':status': status,
        ':processedAt': new Date().toISOString()
      }
    }).promise();
    console.log(`Updated document ${documentId} status to ${status}`);
  } catch (error) {
    console.error(`Failed to update document status for ${documentId}:`, error);
  }
}

async function getDocumentMetadata(documentId) {
  try {
    const result = await dynamodb.get({
      TableName: DOCUMENTATION_TABLE,
      Key: { id: documentId }
    }).promise();
    
    return result.Item || {};
  } catch (error) {
    console.error(`Failed to get document metadata for ${documentId}:`, error);
    return {};
  }
}

function extractTenantFromKey(s3Key) {
  // Extract tenant from S3 key pattern: tenant/folder/file.ext
  const parts = s3Key.split('/');
  return parts.length > 1 ? parts[0] : 'default';
}