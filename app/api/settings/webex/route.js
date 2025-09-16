import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';
import { validateUserSession } from '../../../../lib/auth-check';
import { SSMClient, PutParameterCommand, GetParameterCommand } from '@aws-sdk/client-ssm';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';


export const dynamic = 'force-dynamic';
const ENV = process.env.ENVIRONMENT || 'prod';
const ssmClient = new SSMClient({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
  credentials: fromNodeProviderChain({
    timeout: 5000,
    maxRetries: 3,
  }),
});

export async function GET(request) {
  console.log('\n=== WEBEX SETTINGS GET DEBUG ===');
  console.log('Request URL:', request.url);
  console.log('Environment:', ENV);
  console.log('AWS Region:', process.env.AWS_DEFAULT_REGION);
  
  try {
    const userCookie = request.cookies.get('user-session');
    console.log('User cookie present:', !!userCookie);
    
    const validation = await validateUserSession(userCookie);
    console.log('Session validation:', validation.valid);
    console.log('User is admin:', validation.user?.isAdmin);
    
    if (!validation.valid || !validation.user.isAdmin) {
      console.log('❌ Authorization failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get Webex settings directly from SSM parameters to show current saved values
    let accessToken = '';
    let roomId = '';
    let roomName = '';
    
    try {
      // Try to get access token from SSM
      const tokenParam = ENV === 'prod' ? '/PracticeTools/WEBEX_SCOOP_ACCESS_TOKEN' : `/PracticeTools/${ENV}/WEBEX_SCOOP_ACCESS_TOKEN`;
      console.log('Fetching access token from SSM parameter:', tokenParam);
      
      const tokenCommand = new GetParameterCommand({ Name: tokenParam });
      const tokenResult = await ssmClient.send(tokenCommand);
      
      console.log('SSM token response received:', !!tokenResult.Parameter?.Value);
      accessToken = tokenResult.Parameter?.Value ? '••••••••' : '';
      console.log('Access token status:', accessToken ? 'Present (masked)' : 'Empty');
    } catch (error) {
      console.log('❌ Access token parameter not found in SSM:', error.name);
      console.log('Error details:', error.message);
    }
    
    try {
      // Try to get room ID from SSM
      const roomIdParam = ENV === 'prod' ? '/PracticeTools/WEBEX_SCOOP_ROOM_ID_1' : `/PracticeTools/${ENV}/WEBEX_SCOOP_ROOM_ID_1`;
      console.log('Fetching room ID from SSM parameter:', roomIdParam);
      
      const roomIdCommand = new GetParameterCommand({ Name: roomIdParam });
      const roomIdResult = await ssmClient.send(roomIdCommand);
      
      roomId = roomIdResult.Parameter?.Value || '';
      console.log('Room ID retrieved:', roomId ? roomId.substring(0, 20) + '...' : 'Empty');
    } catch (error) {
      console.log('❌ Room ID parameter not found in SSM:', error.name);
      console.log('Error details:', error.message);
    }
    
    try {
      // Try to get room name from SSM
      const roomNameParam = ENV === 'prod' ? '/PracticeTools/WEBEX_SCOOP_ROOM_NAME' : `/PracticeTools/${ENV}/WEBEX_SCOOP_ROOM_NAME`;
      console.log('Fetching room name from SSM parameter:', roomNameParam);
      
      const roomNameCommand = new GetParameterCommand({ Name: roomNameParam });
      const roomNameResult = await ssmClient.send(roomNameCommand);
      
      roomName = roomNameResult.Parameter?.Value || '';
      console.log('Room name retrieved:', roomName || 'Empty');
    } catch (error) {
      console.log('❌ Room name parameter not found in SSM:', error.name);
      console.log('Error details:', error.message);
    }
    
    // Get webex notifications setting from database
    let webexNotifications = true; // Default to true
    try {
      console.log('Fetching webex notifications setting from database...');
      const setting = await db.getSetting('webex_notifications');
      webexNotifications = setting === 'true' || setting === null;
      console.log('Webex notifications setting:', setting, '→', webexNotifications);
    } catch (error) {
      console.log('❌ Webex notifications setting not found in database:', error.message);
    }
    
    const response = {
      webexNotifications,
      accessToken,
      roomId,
      roomName
    };
    
    console.log('✅ GET response prepared:');
    console.log('  - webexNotifications:', webexNotifications);
    console.log('  - accessToken:', accessToken ? 'Present (masked)' : 'Empty');
    console.log('  - roomId:', roomId ? 'Present' : 'Empty');
    console.log('  - roomName:', roomName || 'Empty');
    console.log('=== WEBEX SETTINGS GET COMPLETED ===\n');
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('❌ WEBEX SETTINGS GET ERROR:', error.name);
    console.error('Error message:', error.message);
    console.error('Stack trace:', error.stack);
    console.log('=== WEBEX SETTINGS GET FAILED ===\n');
    return NextResponse.json({ error: 'Failed to get settings' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid || !validation.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { webexNotifications, accessToken, roomId, roomName } = await request.json();
    
    console.log(`\n=== WEBEX SETTINGS SAVE DEBUG ===`);
    console.log(`Environment: ${ENV}`);
    console.log(`Access Token provided: ${!!accessToken && accessToken !== '••••••••'}`);
    console.log(`Room ID provided: ${!!roomId}`);
    console.log(`Room Name provided: ${!!roomName}`);
    
    // Update Webex settings in SSM parameters
    if (accessToken && accessToken !== '••••••••') {
      const parameterName = ENV === 'prod' ? '/PracticeTools/WEBEX_SCOOP_ACCESS_TOKEN' : `/PracticeTools/${ENV}/WEBEX_SCOOP_ACCESS_TOKEN`;
      console.log(`Saving access token to: ${parameterName}`);
      
      const tokenCommand = new PutParameterCommand({
        Name: parameterName,
        Value: accessToken,
        Type: 'String',
        Overwrite: true
      });
      
      try {
        const result = await ssmClient.send(tokenCommand);
        console.log('✅ WEBEX_SCOOP_ACCESS_TOKEN saved successfully');
        console.log('SSM Response:', result);
      } catch (error) {
        console.error('❌ Failed to save WEBEX_SCOOP_ACCESS_TOKEN:', error);
        throw error;
      }
    }
    
    if (roomId) {
      const parameterName = ENV === 'prod' ? '/PracticeTools/WEBEX_SCOOP_ROOM_ID_1' : `/PracticeTools/${ENV}/WEBEX_SCOOP_ROOM_ID_1`;
      console.log(`Saving room ID to: ${parameterName}`);
      
      const roomIdCommand = new PutParameterCommand({
        Name: parameterName,
        Value: roomId,
        Type: 'String',
        Overwrite: true
      });
      
      try {
        const result = await ssmClient.send(roomIdCommand);
        console.log('✅ WEBEX_SCOOP_ROOM_ID_1 saved successfully');
        console.log('SSM Response:', result);
      } catch (error) {
        console.error('❌ Failed to save WEBEX_SCOOP_ROOM_ID_1:', error);
        throw error;
      }
    }
    
    if (roomName) {
      const parameterName = ENV === 'prod' ? '/PracticeTools/WEBEX_SCOOP_ROOM_NAME' : `/PracticeTools/${ENV}/WEBEX_SCOOP_ROOM_NAME`;
      console.log(`Saving room name to: ${parameterName}`);
      
      const roomNameCommand = new PutParameterCommand({
        Name: parameterName,
        Value: roomName,
        Type: 'String',
        Overwrite: true
      });
      
      try {
        const result = await ssmClient.send(roomNameCommand);
        console.log('✅ WEBEX_SCOOP_ROOM_NAME saved successfully');
        console.log('SSM Response:', result);
      } catch (error) {
        console.error('❌ Failed to save WEBEX_SCOOP_ROOM_NAME:', error);
        throw error;
      }
    }
    
    // Save webex notifications setting to database
    if (webexNotifications !== undefined) {
      try {
        await db.saveSetting('webex_notifications', webexNotifications.toString());
        console.log('✅ Webex notifications setting saved to database:', webexNotifications);
      } catch (error) {
        console.error('❌ Failed to save webex notifications setting:', error);
      }
    }
    
    console.log('=== WEBEX SETTINGS SAVE COMPLETED ===\n');
    
    return NextResponse.json({ success: true, message: 'Webex settings updated successfully' });
  } catch (error) {
    console.error('Error saving webex settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}