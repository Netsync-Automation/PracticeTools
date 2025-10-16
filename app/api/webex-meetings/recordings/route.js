import { NextResponse } from 'next/server';
import { getValidAccessToken } from '../../../../lib/webex-token-manager';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const hostEmail = searchParams.get('hostEmail');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const max = searchParams.get('max') || '100';
    
    const accessToken = await getValidAccessToken();
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Webex access token not configured' }, { status: 401 });
    }
    
    // Build query parameters
    const params = new URLSearchParams({ max });
    if (hostEmail) params.append('hostEmail', hostEmail);
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    
    const response = await fetch(`https://webexapis.com/v1/recordings?${params}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json({ error: 'Access token expired or invalid' }, { status: 401 });
      }
      return NextResponse.json({ error: 'Failed to fetch recordings' }, { status: response.status });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error fetching recordings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}