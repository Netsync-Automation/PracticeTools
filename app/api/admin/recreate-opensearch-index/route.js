import { NextResponse } from 'next/server';
import { createOpenSearchClient } from '../../../../lib/opensearch-setup.js';

export async function POST(request) {
  try {
    const client = createOpenSearchClient();
    const indexName = 'document-vectors';
    
    console.log('Checking if index exists...');
    const exists = await client.indices.exists({ index: indexName });
    
    if (exists.body) {
      console.log(`Deleting existing index ${indexName}...`);
      await client.indices.delete({ index: indexName });
      console.log(`Index ${indexName} deleted.`);
    }
    
    console.log(`Creating index ${indexName} with proper vector mapping...`);
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
    
    console.log(`Index ${indexName} created successfully`);
    
    // Verify mapping
    const mapping = await client.indices.getMapping({ index: indexName });
    const vectorField = mapping.body[indexName]?.mappings?.properties?.vector;
    
    return NextResponse.json({
      success: true,
      message: `Index ${indexName} recreated with proper vector mapping`,
      vectorFieldType: vectorField?.type,
      vectorDimension: vectorField?.dimension
    });
    
  } catch (error) {
    console.error('Error recreating OpenSearch index:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.meta?.body || error.toString()
    }, { status: 500 });
  }
}