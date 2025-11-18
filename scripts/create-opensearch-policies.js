import { OpenSearchServerlessClient, CreateAccessPolicyCommand } from '@aws-sdk/client-opensearchserverless';

const client = new OpenSearchServerlessClient({ region: 'us-east-1' });

async function createDataAccessPolicies() {
  try {
    console.log('Creating OpenSearch data access policies...');
    
    // Data access policy for both collections
    const dataAccessPolicy = {
      name: 'practicetools-data-access',
      type: 'data',
      policy: JSON.stringify([
        {
          Rules: [
            {
              Resource: ['collection/practicetools-*'],
              Permission: [
                'aoss:CreateCollectionItems',
                'aoss:DeleteCollectionItems', 
                'aoss:UpdateCollectionItems',
                'aoss:DescribeCollectionItems'
              ],
              ResourceType: 'collection'
            },
            {
              Resource: ['index/practicetools-*/document-vectors'],
              Permission: [
                'aoss:CreateIndex',
                'aoss:DeleteIndex',
                'aoss:UpdateIndex',
                'aoss:DescribeIndex',
                'aoss:ReadDocument',
                'aoss:WriteDocument'
              ],
              ResourceType: 'index'
            }
          ],
          Principal: [
            'arn:aws:iam::501399536130:role/aws-apprunner-service-role',
            'arn:aws:iam::501399536130:role/PracticeTools-DocumentProcessor-Role',
            `arn:aws:sts::501399536130:assumed-role/aws-apprunner-service-role/*`
          ]
        }
      ])
    };

    try {
      await client.send(new CreateAccessPolicyCommand(dataAccessPolicy));
      console.log('✅ Data access policy created');
    } catch (error) {
      if (error.name === 'ConflictException') {
        console.log('ℹ️  Data access policy already exists');
      } else {
        throw error;
      }
    }

    console.log('\n🔐 Required IAM roles for access:');
    console.log('- AppRunner service role');
    console.log('- Lambda execution role');
    console.log('\n📋 Next steps:');
    console.log('1. Wait for collections to become ACTIVE');
    console.log('2. Get real endpoints with: node scripts/get-opensearch-endpoints.js');
    console.log('3. Update AppRunner configs with real endpoints');
    console.log('4. Create vector indexes');
    
  } catch (error) {
    console.error('Error creating policies:', error.message);
    console.log('\n🛠️  Manual policy creation needed:');
    console.log('1. Go to OpenSearch Service > Serverless > Data access control');
    console.log('2. Create policy with collection/* and index/* permissions');
    console.log('3. Add your AppRunner and Lambda roles as principals');
  }
}

createDataAccessPolicies();