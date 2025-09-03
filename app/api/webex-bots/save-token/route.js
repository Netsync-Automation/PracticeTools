import { NextResponse } from 'next/server';
import { SSMClient, PutParameterCommand } from '@aws-sdk/client-ssm';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { practices, accessToken } = await request.json();
    
    if (!practices || practices.length === 0 || !accessToken) {
      return NextResponse.json({ error: 'Practices and access token are required' }, { status: 400 });
    }
    
    const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
    const practiceKey = practices.sort()[0].toUpperCase().replace(/[^A-Z0-9]/g, '_');
    
    console.log('🔐 Saving access token to SSM...');
    console.log('Practice key:', practiceKey);
    console.log('Token length:', accessToken ? accessToken.length : 0);
    console.log('Token preview:', accessToken ? `${accessToken.substring(0, 10)}...` : 'EMPTY');
    
    // Create SSM parameters for both prod and dev environments
    for (const env of ['prod', 'dev']) {
      const tokenParam = env === 'prod' 
        ? `/PracticeTools/WEBEX_${practiceKey}_ACCESS_TOKEN`
        : `/PracticeTools/${env}/WEBEX_${practiceKey}_ACCESS_TOKEN`;
        
      console.log(`Creating SSM parameter: ${tokenParam}`);
        
      try {
        await ssmClient.send(new PutParameterCommand({
          Name: tokenParam,
          Value: accessToken,
          Type: 'String',
          Overwrite: true
        }));
        console.log(`✓ Successfully created ${tokenParam}`);
      } catch (error) {
        console.error(`❌ Failed to create SSM parameter ${tokenParam}:`, error);
      }
      
      // Create placeholder room parameters
      const roomIdParam = env === 'prod' 
        ? `/PracticeTools/WEBEX_${practiceKey}_ROOM_ID_1`
        : `/PracticeTools/${env}/WEBEX_${practiceKey}_ROOM_ID_1`;
        
      const roomNameParam = env === 'prod' 
        ? `/PracticeTools/WEBEX_${practiceKey}_ROOM_NAME`
        : `/PracticeTools/${env}/WEBEX_${practiceKey}_ROOM_NAME`;
        
      try {
        await ssmClient.send(new PutParameterCommand({
          Name: roomIdParam,
          Value: 'PLACEHOLDER_ROOM_ID',
          Type: 'String',
          Overwrite: true
        }));
        
        await ssmClient.send(new PutParameterCommand({
          Name: roomNameParam,
          Value: 'PLACEHOLDER_ROOM_NAME',
          Type: 'String',
          Overwrite: true
        }));
      } catch (error) {
        console.error(`Failed to create room SSM parameters:`, error);
      }
    }
    
    return NextResponse.json({ success: true, ssmPrefix: practiceKey });
  } catch (error) {
    console.error('Error saving access token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}