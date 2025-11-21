import { OpenSearchServerlessClient, CreateCollectionCommand, CreateSecurityPolicyCommand } from '@aws-sdk/client-opensearchserverless';

const client = new OpenSearchServerlessClient({ region: 'us-east-1' });

async function createOpenSearchCollection() {
  try {
    // Create network security policy first
    console.log('Creating network security policy...');
    const networkPolicy = {
      name: 'practicetools-network-policy',
      type: 'network',
      policy: JSON.stringify([{
        Rules: [
          {
            Resource: ['collection/practicetools-*'],
            ResourceType: 'collection'
          }
        ],
        AllowFromPublic: true
      }])
    };

    try {
      await client.send(new CreateSecurityPolicyCommand(networkPolicy));
      console.log('Network security policy created');
    } catch (error) {
      if (error.name === 'ConflictException') {
        console.log('Network security policy already exists');
      } else {
        throw error;
      }
    }

    // Create encryption security policy
    console.log('Creating encryption security policy...');
    const encryptionPolicy = {
      name: 'practicetools-encryption-policy',
      type: 'encryption',
      policy: JSON.stringify({
        Rules: [
          {
            Resource: ['collection/practicetools-*'],
            ResourceType: 'collection'
          }
        ],
        AWSOwnedKey: true
      })
    };

    try {
      await client.send(new CreateSecurityPolicyCommand(encryptionPolicy));
      console.log('Encryption security policy created');
    } catch (error) {
      if (error.name === 'ConflictException') {
        console.log('Encryption security policy already exists');
      } else {
        throw error;
      }
    }

    // Create collections for both environments
    const environments = ['dev', 'prod'];
    
    for (const env of environments) {
      console.log(`\n=== Creating ${env.toUpperCase()} collection ===`);
      
      const collectionParams = {
        name: `practicetools-${env}-vectors`,
        type: 'VECTORSEARCH',
        description: `Document vector search collection for ${env} environment`
      };

      try {
        const result = await client.send(new CreateCollectionCommand(collectionParams));
        console.log(`Collection created for ${env}:`, result.createCollectionDetail.name);
        console.log(`Endpoint: ${result.createCollectionDetail.collectionEndpoint}`);
      } catch (error) {
        if (error.name === 'ConflictException') {
          console.log(`Collection already exists for ${env}`);
        } else {
          throw error;
        }
      }
    }

    console.log('\nAll OpenSearch collections created successfully!');
    console.log('\nNext steps:');
    console.log('1. Update your AppRunner configuration with the collection endpoints');
    console.log('2. Configure data access policies in the AWS Console');
    
  } catch (error) {
    console.error('Error creating OpenSearch collection:', error);
    throw error;
  }
}

createOpenSearchCollection();