import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

const ssmClient = new SSMClient({
  region: 'us-east-1',
  credentials: fromNodeProviderChain({
    timeout: 5000,
    maxRetries: 3,
  }),
});

async function checkSSMParameter() {
  try {
    const command = new GetParameterCommand({
      Name: '/PracticeTools/dev/DUO_METADATA_FILE',
      WithDecryption: true
    });
    const result = await ssmClient.send(command);
    console.log('SSM Parameter /PracticeTools/dev/DUO_METADATA_FILE:');
    console.log('Length:', result.Parameter?.Value?.length || 0);
    console.log('First 200 chars:', result.Parameter?.Value?.substring(0, 200) || 'EMPTY');
    console.log('Contains XML?', result.Parameter?.Value?.includes('<?xml') || false);
  } catch (error) {
    console.error('Error fetching SSM parameter:', error.message);
  }
}

checkSSMParameter();