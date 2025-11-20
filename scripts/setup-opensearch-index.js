import { createOpenSearchClient } from '../lib/opensearch-setup.js';

async function setupVectorIndex() {
  const client = createOpenSearchClient();
  const indexName = 'document-vectors';
  
  try {
    // Check if index exists
    const exists = await client.indices.exists({ index: indexName });
    
    if (exists.body) {
      console.log(`Index ${indexName} exists. Deleting to recreate with proper mapping...`);
      await client.indices.delete({ index: indexName });
      console.log(`Index ${indexName} deleted.`);
    }
    
    // Create index with proper vector mapping
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
          createdAt: { type: 'date' },
          expirationDate: { type: 'date' }
        }
      }
    };
    
    const response = await client.indices.create({
      index: indexName,
      body: indexBody
    });
    
    console.log(`Vector index ${indexName} created successfully with proper mapping:`, response.body);
    
    // Verify the mapping
    const mapping = await client.indices.getMapping({ index: indexName });
    console.log('Index mapping verified:', JSON.stringify(mapping.body[indexName].mappings, null, 2));
    
  } catch (error) {
    console.error('Error setting up vector index:', error);
    throw error;
  }
}

setupVectorIndex().catch(console.error);