import { NextResponse } from 'next/server';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssmClient = new SSMClient({ region: 'us-east-1' });
const env = process.env.ENVIRONMENT || 'dev';

function getSitePrefix(siteUrl) {
  return siteUrl.split('.')[0].toUpperCase();
}

export async function POST(request) {
  try {
    const { siteUrl, botToken, search = '' } = await request.json();

    if (!siteUrl) {
      return NextResponse.json({ error: 'siteUrl is required' }, { status: 400 });
    }

    let tokenToUse = botToken;
    if (!tokenToUse) {
      const sitePrefix = getSitePrefix(siteUrl);
      const basePath = env === 'prod' ? 'PracticeTools' : `PracticeTools/${env}`;
      const paramName = `/${basePath}/${sitePrefix}_WEBEX_MESSAGING_BOT_TOKEN_1`;
      
      try {
        const param = await ssmClient.send(new GetParameterCommand({ Name: paramName }));
        tokenToUse = param.Parameter.Value;
      } catch (e) {
        return NextResponse.json({ error: 'No bot token configured' }, { status: 400 });
      }
    }

    let allRooms = [];
    let nextUrl = 'https://webexapis.com/v1/rooms?max=1000&sortBy=lastactivity';

    while (nextUrl) {
      const response = await fetch(nextUrl, {
        headers: {
          'Authorization': `Bearer ${tokenToUse}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json({ error: `Webex API error: ${errorText}` }, { status: response.status });
      }

      const data = await response.json();
      allRooms = allRooms.concat(data.items || []);

      const linkHeader = response.headers.get('Link');
      nextUrl = null;
      if (linkHeader) {
        const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        if (nextMatch) nextUrl = nextMatch[1];
      }
    }

    let rooms = allRooms;
    if (search) {
      const searchLower = search.toLowerCase();
      rooms = allRooms.filter(room => 
        room.title?.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json({ 
      rooms: rooms.map(room => ({
        id: room.id,
        title: room.title,
        type: room.type
      }))
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to search rooms', details: error.message }, { status: 500 });
  }
}
