import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';

export const createOpenSearchClient = () => {
  const endpoint = process.env.OPENSEARCH_ENDPOINT || 'https://your-opensearch-endpoint.us-east-1.aoss.amazonaws.com';
  
  return new Client({
    ...AwsSigv4Signer({
      region: 'us-east-1',
      service: 'aoss'
    }),
    node: endpoint
  });
};

export const createVectorIndex = async () => {
  const client = createOpenSearchClient();
  
  const indexName = 'document-vectors';
  const indexBody = {
    settings: {
      index: {
        knn: true,
        'knn.algo_param.ef_search': 100
      }
    },
    mappings: {
      properties: {
        documentId: { type: 'keyword' },
        chunkIndex: { type: 'integer' },
        text: { type: 'text' },
        vector: {
          type: 'knn_vector',
          dimension: 1536, // Titan embeddings dimension
          method: {
            name: 'hnsw',
            space_type: 'cosinesimil',
            engine: 'nmslib'
          }
        },
        s3Key: { type: 'keyword' },
        tenantId: { type: 'keyword' },
        createdAt: { type: 'date' },
        expirationDate: { type: 'date' }
      }
    }
  };
  
  try {
    const response = await client.indices.create({
      index: indexName,
      body: indexBody
    });
    console.log('Vector index created:', response);
    return response;
  } catch (error) {
    if (error.meta?.body?.error?.type === 'resource_already_exists_exception') {
      console.log('Vector index already exists');
    } else {
      throw error;
    }
  }
};