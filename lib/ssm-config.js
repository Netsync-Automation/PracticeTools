import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

let ssmClient = null;
const parameterCache = new Map();

function getSSMClient() {
  if (!ssmClient) {
    ssmClient = new SSMClient({
      region: process.env.AWS_DEFAULT_REGION || 'us-east-1'
    });
  }
  return ssmClient;
}

export async function getSecureParameter(parameterName) {
  if (parameterCache.has(parameterName)) {
    return parameterCache.get(parameterName);
  }

  try {
    const client = getSSMClient();
    const command = new GetParameterCommand({
      Name: parameterName,
      WithDecryption: true
    });
    
    const result = await client.send(command);
    const value = result.Parameter?.Value;
    
    if (value) {
      parameterCache.set(parameterName, value);
    }
    
    return value;
  } catch (error) {
    console.error(`Failed to get parameter ${parameterName}:`, error);
    return null;
  }
}