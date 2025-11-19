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
      console.log(`Processing ${fileExtension.toUpperCase()} file with Textract`);
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
    console.log(`Document chunks stored in DynamoDB with correlation to OpenSearch auto-generated IDs`);
  } catch (error) {
    console.error(`Error processing documentation/${documentId}/${key.split('/').pop()}:`, error);
    // Update Documentation table status to failed
    await updateDocumentStatus(documentId, 'failed');
    throw error;
  }
}

async function extractTextWithTextract(bucket, key) {
  console.log(`Starting Textract processing for s3://${bucket}/${key}`);
  
  const params = {
    DocumentLocation: {
      S3Object: {
        Bucket: bucket,
        Name: key // Key is already decoded in processDocument function
      }
    }
  };
  
  console.log('Calling startDocumentTextDetection...');
  const startResult = await textract.startDocumentTextDetection(params).promise();
  const jobId = startResult.JobId;
  console.log(`Textract job started with ID: ${jobId}`);
  
  // Poll for completion
  let jobStatus = 'IN_PROGRESS';
  let pollCount = 0;
  while (jobStatus === 'IN_PROGRESS') {
    pollCount++;
    console.log(`Polling Textract job ${jobId}, attempt ${pollCount}`);
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    
    const statusResult = await textract.getDocumentTextDetection({ JobId: jobId }).promise();
    jobStatus = statusResult.JobStatus;
    console.log(`Textract job ${jobId} status: ${jobStatus}`);
    
    if (jobStatus === 'SUCCEEDED') {
      console.log(`Textract job ${jobId} completed successfully, retrieving results...`);
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
      
      console.log(`Extracted ${extractedText.length} characters from Textract`);
      return extractedText;
    } else if (jobStatus === 'FAILED') {
      throw new Error(`Textract job ${jobId} failed`);
    }
    
    // Safety check to prevent infinite polling
    if (pollCount > 60) { // 5 minutes of polling
      throw new Error(`Textract job ${jobId} timed out after ${pollCount} polls`);
    }
  }
}

async function analyzeDocumentSync(bucket, key) {
  const params = {
    Document: {
      S3Object: {
        Bucket: bucket,
        Name: key // Key is already decoded in processDocument function
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
  const result = await s3.getObject({ Bucket: bucket, Key: key }).promise(); // Key is already decoded
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
  
  // Prepare vector document for OpenSearch (without specifying ID)
  const vectorBody = {
    documentId,
    chunkIndex,
    text: chunkText,
    vector: embedding,
    s3Key,
    tenantId: extractTenantFromKey(s3Key),
    createdAt: new Date().toISOString()
  };
  
  // Add expiration date if present
  if (documentMetadata.expirationDate) {
    vectorBody.expirationDate = documentMetadata.expirationDate;
  }
  
  try {
    // Index in OpenSearch Serverless WITHOUT specifying document ID (auto-generated)
    console.log(`Indexing chunk ${chunkIndex} for document ${documentId} in OpenSearch...`);
    const osResponse = await opensearchClient.index({
      index: 'document-vectors',
      body: vectorBody
    });
    
    // Capture the auto-generated OpenSearch document ID
    const osDocId = osResponse._id || osResponse.body?._id;
    console.log(`OpenSearch auto-generated ID: ${osDocId}`);
    
    if (!osDocId) {
      throw new Error('Failed to get auto-generated document ID from OpenSearch response');
    }
    
    // Store in DynamoDB with OpenSearch document ID for correlation
    const chunkItem = {
      pk: `DOC#${documentId}`,
      sk: `CHUNK#${String(chunkIndex).padStart(5, '0')}`,
      documentId,
      s3Key,
      chunkIndex,
      extractedText: chunkText,
      osDocId, // Store the auto-generated OpenSearch document ID
      tenantId: vectorBody.tenantId,
      createdAt: vectorBody.createdAt,
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
    
    console.log(`Successfully stored chunk ${chunkIndex} - DynamoDB: ${chunkItem.pk}/${chunkItem.sk}, OpenSearch: ${osDocId}`);
    
  } catch (error) {
    console.error(`Failed to process document chunk ${documentId}-${chunkIndex}:`, {
      errorType: error.name,
      errorMessage: error.message,
      statusCode: error.meta?.statusCode,
      responseBody: error.meta?.body
    });
    throw error;
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
    console.log(`Updating document ${documentId} status to ${status} in table: ${DOCUMENTATION_TABLE}`);
    
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
    console.error(`Failed to update document status for ${documentId} in table ${DOCUMENTATION_TABLE}:`, error);
  }
}

async function getDocumentMetadata(documentId) {
  try {
    console.log(`Getting document metadata for ${documentId} from table: ${DOCUMENTATION_TABLE}`);
    console.log(`Environment: ${getEnvironment()}`);
    
    const result = await dynamodb.get({
      TableName: DOCUMENTATION_TABLE,
      Key: { id: documentId }
    }).promise();
    
    console.log(`Document metadata result:`, result.Item ? 'Found' : 'Not found');
    return result.Item || {};
  } catch (error) {
    console.error(`Failed to get document metadata for ${documentId} from table ${DOCUMENTATION_TABLE}:`, error);
    return {};
  }
}

function extractTenantFromKey(s3Key) {
  // Extract tenant from S3 key pattern: tenant/folder/file.ext
  const parts = s3Key.split('/');
  return parts.length > 1 ? parts[0] : 'default';
}