import { SSMClient, GetParameterCommand, PutParameterCommand } from '@aws-sdk/client-ssm';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

let ssmClient = null;

function getSSMClient() {
  if (!ssmClient) {
    ssmClient = new SSMClient({
      region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
      credentials: fromNodeProviderChain({
        timeout: 5000,
        maxRetries: 3,
      })
    });
  }
  return ssmClient;
}

function getSSMPath(paramName) {
  const ENV = process.env.ENVIRONMENT || 'dev';
  return ENV === 'prod' ? `/PracticeTools/${paramName}` : `/PracticeTools/${ENV}/${paramName}`;
}

export async function getSSMParameter(paramName) {
  try {
    const ssmPath = getSSMPath(paramName);
    
    const client = getSSMClient();
    const command = new GetParameterCommand({
      Name: ssmPath,
      WithDecryption: true
    });
    
    const response = await client.send(command);
    return response.Parameter?.Value;
  } catch (error) {
    console.error(`Failed to get SSM parameter ${getSSMPath(paramName)}:`, error.message);
    throw error;
  }
}

export async function putSSMParameter(paramName, value, type = 'String') {
  try {
    const ssmPath = getSSMPath(paramName);
    
    const client = getSSMClient();
    const command = new PutParameterCommand({
      Name: ssmPath,
      Value: value,
      Type: type,
      Overwrite: true
    });
    
    await client.send(command);
    return true;
  } catch (error) {
    console.error(`Failed to put SSM parameter ${getSSMPath(paramName)}:`, error.message);
    throw error;
  }
}

export async function getMultipleSSMParameters(paramNames) {
  try {
    const results = await Promise.all(
      paramNames.map(async (paramName) => {
        try {
          const value = await getSSMParameter(paramName);
          return { [paramName]: value };
        } catch (error) {
          return { [paramName]: '' };
        }
      })
    );
    
    return results.reduce((acc, result) => ({ ...acc, ...result }), {});
  } catch (error) {
    console.error('Failed to get multiple SSM parameters:', error.message);
    throw error;
  }
}