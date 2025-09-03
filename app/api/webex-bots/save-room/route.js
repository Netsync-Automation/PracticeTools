import { NextResponse } from 'next/server';
import { SSMClient, PutParameterCommand } from '@aws-sdk/client-ssm';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { ssmPrefix, roomId, roomName } = await request.json();
    
    if (!ssmPrefix || !roomId || !roomName) {
      return NextResponse.json({ error: 'SSM prefix, room ID, and room name are required' }, { status: 400 });
    }
    
    const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
    
    // Update room parameters for both prod and dev environments
    for (const env of ['prod', 'dev']) {
      const roomIdParam = env === 'prod' 
        ? `/PracticeTools/WEBEX_${ssmPrefix}_ROOM_ID_1`
        : `/PracticeTools/${env}/WEBEX_${ssmPrefix}_ROOM_ID_1`;
        
      const roomNameParam = env === 'prod' 
        ? `/PracticeTools/WEBEX_${ssmPrefix}_ROOM_NAME`
        : `/PracticeTools/${env}/WEBEX_${ssmPrefix}_ROOM_NAME`;
        
      try {
        await ssmClient.send(new PutParameterCommand({
          Name: roomIdParam,
          Value: roomId,
          Type: 'String',
          Overwrite: true
        }));
        
        await ssmClient.send(new PutParameterCommand({
          Name: roomNameParam,
          Value: roomName,
          Type: 'String',
          Overwrite: true
        }));
      } catch (error) {
        console.error(`Failed to update room SSM parameters for ${env}:`, error);
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving room:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}