import { NextResponse } from 'next/server';
import { getValidAccessToken } from '../../../../lib/webex-token-manager';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const meetingId = searchParams.get('meetingId');
    
    if (!meetingId) {
      return NextResponse.json({ error: 'meetingId parameter required' }, { status: 400 });
    }
    
    const accessToken = await getValidAccessToken();
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Webex access token not configured' }, { status: 401 });
    }
    
    const response = await fetch(`https://webexapis.com/v1/meetingTranscripts?meetingId=${meetingId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json({ error: 'Access token expired or invalid' }, { status: 401 });
      }
      return NextResponse.json({ error: 'Failed to fetch transcripts' }, { status: response.status });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error fetching transcripts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}