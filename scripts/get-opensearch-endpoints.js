import { OpenSearchServerlessClient, ListCollectionsCommand } from '@aws-sdk/client-opensearchserverless';

const client = new OpenSearchServerlessClient({ region: 'us-east-1' });

async function getCollectionEndpoints() {
  try {
    const result = await client.send(new ListCollectionsCommand({}));
    
    console.log('OpenSearch Serverless Collections:');
    console.log('================================');
    
    const practiceToolsCollections = result.collectionSummaries?.filter(
      collection => collection.name?.startsWith('practicetools-')
    ) || [];
    
    if (practiceToolsCollections.length === 0) {
      console.log('❌ No PracticeTools collections found');
      console.log('\nYou need to create them manually in AWS Console:');
      console.log('1. Go to OpenSearch Service > Serverless collections');
      console.log('2. Create collection: practicetools-dev-vectors (type: Vector search)');
      console.log('3. Create collection: practicetools-prod-vectors (type: Vector search)');
      return;
    }
    
    practiceToolsCollections.forEach(collection => {
      console.log(`\n📍 ${collection.name}`);
      console.log(`   Status: ${collection.status}`);
      console.log(`   Endpoint: ${collection.collectionEndpoint || 'Not available yet'}`);
      console.log(`   Dashboard: ${collection.dashboardEndpoint || 'Not available yet'}`);
    });
    
    console.log('\n🔧 Update your AppRunner configs with these endpoints:');
    practiceToolsCollections.forEach(collection => {
      if (collection.collectionEndpoint) {
        const env = collection.name.includes('-dev-') ? 'dev' : 'prod';
        console.log(`${env.toUpperCase()}: ${collection.collectionEndpoint}`);
      }
    });
    
  } catch (error) {
    console.error('Error getting collection endpoints:', error.message);
    console.log('\n📋 Manual steps needed:');
    console.log('1. Go to AWS Console > OpenSearch Service > Serverless collections');
    console.log('2. Check if collections exist and are active');
    console.log('3. Copy the collection endpoints');
    console.log('4. Update apprunner-dev.yaml and apprunner-prod.yaml');
  }
}

getCollectionEndpoints();