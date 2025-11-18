import { OpenSearchServerlessClient, BatchGetCollectionCommand } from '@aws-sdk/client-opensearchserverless';

const client = new OpenSearchServerlessClient({ region: 'us-east-1' });

async function getCollectionDetails() {
  try {
    const result = await client.send(new BatchGetCollectionCommand({
      names: ['practicetools-dev-vectors', 'practicetools-prod-vectors']
    }));
    
    console.log('📍 OpenSearch Collection Details:\n');
    
    result.collectionDetails?.forEach(collection => {
      console.log(`🔹 ${collection.name}`);
      console.log(`   Status: ${collection.status}`);
      console.log(`   Endpoint: ${collection.collectionEndpoint || 'Not available'}`);
      console.log(`   Dashboard: ${collection.dashboardEndpoint || 'Not available'}`);
      console.log('');
    });
    
    const devCollection = result.collectionDetails?.find(c => c.name.includes('-dev-'));
    const prodCollection = result.collectionDetails?.find(c => c.name.includes('-prod-'));
    
    if (devCollection?.collectionEndpoint && prodCollection?.collectionEndpoint) {
      console.log('✅ Ready to update AppRunner configs:');
      console.log(`DEV:  ${devCollection.collectionEndpoint}`);
      console.log(`PROD: ${prodCollection.collectionEndpoint}`);
    } else {
      console.log('⚠️  Endpoints not ready yet. Collections may still be initializing.');
    }
    
  } catch (error) {
    console.error('Error getting collection details:', error.message);
  }
}

getCollectionDetails();