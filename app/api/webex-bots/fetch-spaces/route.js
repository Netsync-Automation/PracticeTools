import { NextResponse } from 'next/server';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { ssmPrefix, accessToken } = await request.json();
    
    if (!ssmPrefix) {
      return NextResponse.json({ error: 'SSM prefix is required' }, { status: 400 });
    }
    
    const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
    const ENV = process.env.ENVIRONMENT || 'dev';
    
    console.log('🔍 Fetching spaces with SSM prefix:', ssmPrefix);
    console.log('Environment:', ENV);
    
    let token = accessToken;
    
    console.log('🔍 Received accessToken:', accessToken ? `${accessToken.substring(0, 10)}...` : 'NONE');
    
    // If no token provided, get from SSM
    if (!token) {
      // Get access token from SSM
      const tokenParam = ENV === 'prod' 
        ? `/PracticeTools/WEBEX_${ssmPrefix}_ACCESS_TOKEN`
        : `/PracticeTools/${ENV}/WEBEX_${ssmPrefix}_ACCESS_TOKEN`;
        
      console.log('SSM Parameter path:', tokenParam);
        
      try {
        const tokenCommand = new GetParameterCommand({ Name: tokenParam });
        const tokenResult = await ssmClient.send(tokenCommand);
        token = tokenResult.Parameter?.Value;
        console.log('Token retrieved from SSM:', token ? `${token.substring(0, 10)}...` : 'EMPTY');
      } catch (error) {
        console.error('SSM Parameter not found:', error.message);
        return NextResponse.json({ error: `Access token not found in SSM: ${tokenParam}` }, { status: 404 });
      }
    } else {
      console.log('✅ Using provided access token:', token ? `${token.substring(0, 10)}...` : 'EMPTY');
    }
    
    if (!token || token === 'PLACEHOLDER_TOKEN') {
      return NextResponse.json({ error: 'Access token is empty or placeholder' }, { status: 400 });
    }
    
    console.log('🚀 Making WebEx API request...');
    
    // Fetch rooms using the token
    const response = await fetch('https://webexapis.com/v1/rooms', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('WebEx API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('WebEx API error:', errorText);
      return NextResponse.json({ error: `WebEx API error: ${response.status} - ${errorText}` }, { status: response.status });
    }
    
    const data = await response.json();
    console.log('Rooms fetched successfully:', data.items?.length || 0, 'rooms');
    return NextResponse.json({ rooms: data.items || [] });
    
  } catch (error) {
    console.error('Error fetching spaces:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}