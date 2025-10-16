import { NextResponse } from 'next/server';
import { SSMClient, GetParameterCommand, PutParameterCommand, DeleteParameterCommand } from '@aws-sdk/client-ssm';
import { getEnvironment } from '../../../../lib/dynamodb';

export const dynamic = 'force-dynamic';

const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

async function getSSMParameter(name) {
  try {
    const command = new GetParameterCommand({
      Name: name,
      WithDecryption: true
    });
    const response = await ssmClient.send(command);
    return response.Parameter?.Value;
  } catch (error) {
    return null;
  }
}

async function deleteSSMParameter(name) {
  try {
    const command = new DeleteParameterCommand({ Name: name });
    await ssmClient.send(command);
    return true;
  } catch (error) {
    return false;
  }
}

async function putSSMParameter(name, value) {
  try {
    const command = new PutParameterCommand({
      Name: name,
      Value: value,
      Type: 'String',
      Overwrite: true
    });
    await ssmClient.send(command);
    return true;
  } catch (error) {
    return false;
  }
}

export async function POST() {
  try {
    const env = getEnvironment();
    const prefix = env === 'prod' ? '/PracticeTools' : `/PracticeTools/${env}`;
    
    const parameterNames = [
      'WEBEX_MEETINGS_CLIENT_ID',
      'WEBEX_MEETINGS_CLIENT_SECRET', 
      'WEBEX_MEETINGS_ACCESS_TOKEN',
      'WEBEX_MEETINGS_REFRESH_TOKEN'
    ];
    
    const results = [];
    
    for (const paramName of parameterNames) {
      const fullName = `${prefix}/${paramName}`;
      
      // Get current value
      const currentValue = await getSSMParameter(fullName);
      
      if (currentValue) {
        // Delete SecureString parameter
        const deleted = await deleteSSMParameter(fullName);
        
        if (deleted) {
          // Recreate as String parameter
          const created = await putSSMParameter(fullName, currentValue);
          
          results.push({
            parameter: paramName,
            status: created ? 'converted' : 'failed_to_recreate',
            value: currentValue ? 'present' : 'missing'
          });
        } else {
          results.push({
            parameter: paramName,
            status: 'failed_to_delete',
            value: 'present'
          });
        }
      } else {
        results.push({
          parameter: paramName,
          status: 'not_found',
          value: 'missing'
        });
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      environment: env,
      results 
    });
    
  } catch (error) {
    console.error('Error fixing SSM parameters:', error);
    return NextResponse.json({ error: 'Failed to fix SSM parameters' }, { status: 500 });
  }
}