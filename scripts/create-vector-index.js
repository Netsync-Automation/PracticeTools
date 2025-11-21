import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';

async function createVectorIndex(endpoint) {
  const client = new Client({
    ...AwsSigv4Signer({
      region: 'us-east-1',
      service: 'aoss'
    }),
    node: endpoint
  });
  
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
          dimension: 1536,
          method: {
            name: 'hnsw',
            space_type: 'cosinesimil',
            engine: 'nmslib'
          }
        },
        s3Key: { type: 'keyword' },
        tenantId: { type: 'keyword' },
        createdAt: { type: 'date' }
      }
    }
  };
  
  try {
    await client.indices.create({
      index: indexName,
      body: indexBody
    });
    console.log('✅ Vector index created');
  } catch (error) {
    if (error.meta?.body?.error?.type === 'resource_already_exists_exception') {
      console.log('ℹ️  Vector index already exists');
    } else {
      throw error;
    }
  }
}

async function setupVectorIndexes() {
  const endpoints = {
    dev: 'https://8st52hujhn4om815yz4l.us-east-1.aoss.amazonaws.com',
    prod: 'https://9nagbvhy3f5jrpqjoo6l.us-east-1.aoss.amazonaws.com'
  };
  
  for (const [env, endpoint] of Object.entries(endpoints)) {
    console.log(`\n=== Creating vector index for ${env.toUpperCase()} ===`);
    try {
      await createVectorIndex(endpoint);
    } catch (error) {
      console.error(`❌ Error for ${env}:`, error.message);
    }
  }
}

setupVectorIndexes();