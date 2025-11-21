import { LambdaClient, UpdateFunctionConfigurationCommand } from '@aws-sdk/client-lambda';

const lambdaClient = new LambdaClient({ region: 'us-east-1' });

async function updateLambdaConfig() {
  try {
    console.log('Updating Lambda function configuration...');
    
    const params = {
      FunctionName: 'PracticeTools-DocumentProcessor',
      Environment: {
        Variables: {
          CHUNKS_TABLE: 'PracticeTools-prod-DocumentChunks',
          OPENSEARCH_ENDPOINT: 'https://9nagbvhy3f5jrpqjoo6l.us-east-1.aoss.amazonaws.com'
        }
      }
    };
    
    const result = await lambdaClient.send(new UpdateFunctionConfigurationCommand(params));
    console.log('Lambda configuration updated successfully');
    console.log('Environment variables set:');
    console.log('- CHUNKS_TABLE:', params.Environment.Variables.CHUNKS_TABLE);
    console.log('- OPENSEARCH_ENDPOINT:', params.Environment.Variables.OPENSEARCH_ENDPOINT);
    
  } catch (error) {
    console.error('Error updating Lambda configuration:', error);
  }
}

updateLambdaConfig();