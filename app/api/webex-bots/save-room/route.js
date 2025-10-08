import { NextResponse } from 'next/server';
import { SSMClient, PutParameterCommand } from '@aws-sdk/client-ssm';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { ssmPrefix, roomId, roomName, roomNumber = 1 } = await request.json();
    
    if (!ssmPrefix || !roomId || !roomName) {
      return NextResponse.json({ error: 'SSM prefix, room ID, and room name are required' }, { status: 400 });
    }
    
    const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
    
    // DSR: Update room parameters for both prod and dev environments with proper numbering
    for (const env of ['prod', 'dev']) {
      let roomIdParam, roomNameParam;
      
      if (roomNumber === 1) {
        // DSR: Room 1 uses legacy naming (no number suffix for room name)
        roomIdParam = env === 'prod' 
          ? `/PracticeTools/WEBEX_${ssmPrefix}_ROOM_ID_1`
          : `/PracticeTools/${env}/WEBEX_${ssmPrefix}_ROOM_ID_1`;
          
        roomNameParam = env === 'prod' 
          ? `/PracticeTools/WEBEX_${ssmPrefix}_ROOM_NAME`
          : `/PracticeTools/${env}/WEBEX_${ssmPrefix}_ROOM_NAME`;
      } else {
        // DSR: Room 2+ uses numbered naming convention
        roomIdParam = env === 'prod' 
          ? `/PracticeTools/WEBEX_${ssmPrefix}_ROOM_ID_${roomNumber}`
          : `/PracticeTools/${env}/WEBEX_${ssmPrefix}_ROOM_ID_${roomNumber}`;
          
        roomNameParam = env === 'prod' 
          ? `/PracticeTools/WEBEX_${ssmPrefix}_ROOM_NAME_${roomNumber}`
          : `/PracticeTools/${env}/WEBEX_${ssmPrefix}_ROOM_NAME_${roomNumber}`;
      }
        
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
        throw error;
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving room:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}