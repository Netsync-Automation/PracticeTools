import { OpenSearchServerlessClient, ListCollectionsCommand } from '@aws-sdk/client-opensearchserverless';

const client = new OpenSearchServerlessClient({ region: 'us-east-1' });

async function monitorCollections() {
  console.log('🔍 Monitoring OpenSearch collections...\n');
  
  let allActive = false;
  let attempts = 0;
  const maxAttempts = 30; // 15 minutes max
  
  while (!allActive && attempts < maxAttempts) {
    try {
      const result = await client.send(new ListCollectionsCommand({}));
      const collections = result.collectionSummaries?.filter(
        c => c.name?.startsWith('practicetools-')
      ) || [];
      
      console.clear();
      console.log(`🔍 Check ${attempts + 1}/${maxAttempts} - ${new Date().toLocaleTimeString()}\n`);
      
      let activeCount = 0;
      collections.forEach(collection => {
        const status = collection.status === 'ACTIVE' ? '✅' : '⏳';
        console.log(`${status} ${collection.name}: ${collection.status}`);
        if (collection.collectionEndpoint) {
          console.log(`   📍 ${collection.collectionEndpoint}`);
        }
        if (collection.status === 'ACTIVE') activeCount++;
      });
      
      if (activeCount === collections.length && collections.length === 2) {
        allActive = true;
        console.log('\n🎉 All collections are ACTIVE!');
        
        // Update AppRunner configs
        const devCollection = collections.find(c => c.name.includes('-dev-'));
        const prodCollection = collections.find(c => c.name.includes('-prod-'));
        
        if (devCollection?.collectionEndpoint && prodCollection?.collectionEndpoint) {
          console.log('\n📝 Update your AppRunner configs:');
          console.log(`DEV:  ${devCollection.collectionEndpoint}`);
          console.log(`PROD: ${prodCollection.collectionEndpoint}`);
          
          console.log('\n🚀 Next steps:');
          console.log('1. Update apprunner-dev.yaml and apprunner-prod.yaml');
          console.log('2. Run: node scripts/create-vector-index.js');
          console.log('3. Test document upload and query');
        }
        break;
      }
      
      console.log(`\n⏱️  Waiting 30 seconds... (${activeCount}/${collections.length} active)`);
      await new Promise(resolve => setTimeout(resolve, 30000));
      attempts++;
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      break;
    }
  }
  
  if (!allActive) {
    console.log('\n⚠️  Collections taking longer than expected. Check AWS Console.');
  }
}

monitorCollections();