import { NextResponse } from 'next/server';

let clients = new Map();

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId') || Date.now().toString();

  const stream = new ReadableStream({
    start(controller) {
      clients.set(clientId, controller);

      const data = `data: ${JSON.stringify({
        type: 'connected',
        clientId: clientId,
        timestamp: Date.now()
      })}\n\n`;
      
      controller.enqueue(new TextEncoder().encode(data));

      // Send keepalive every 30 seconds
      const keepalive = setInterval(() => {
        try {
          const ping = `data: ${JSON.stringify({ type: 'ping', timestamp: Date.now() })}\n\n`;
          controller.enqueue(new TextEncoder().encode(ping));
        } catch (error) {
          clearInterval(keepalive);
          clients.delete(clientId);
        }
      }, 30000);

      request.signal.addEventListener('abort', () => {
        clearInterval(keepalive);
        clients.delete(clientId);
        try {
          controller.close();
        } catch (error) {
          // Controller already closed
        }
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  });
}

export async function POST(request) {
  try {
    const { type, data } = await request.json();

    const message = `data: ${JSON.stringify({
      type,
      data,
      timestamp: Date.now()
    })}\n\n`;

    const encoder = new TextEncoder();
    const encodedMessage = encoder.encode(message);

    for (const [clientId, controller] of clients.entries()) {
      try {
        controller.enqueue(encodedMessage);
      } catch (error) {
        clients.delete(clientId);
      }
    }

    return NextResponse.json({ success: true, clientCount: clients.size });
  } catch (error) {
    console.error('SSE broadcast error:', error);
    return NextResponse.json({ error: 'Failed to broadcast message' }, { status: 500 });
  }
}

export function notifyWebexMeetingsUpdate(data) {
  const message = `data: ${JSON.stringify({
    type: 'webex_meetings_updated',
    data,
    timestamp: Date.now()
  })}\n\n`;

  const encoder = new TextEncoder();
  const encodedMessage = encoder.encode(message);

  for (const [clientId, controller] of clients.entries()) {
    try {
      controller.enqueue(encodedMessage);
    } catch (error) {
      clients.delete(clientId);
    }
  }
}

export function notifyWebexRecordingsUpdate(data) {
  const message = `data: ${JSON.stringify({
    type: 'webex_recordings_updated',
    data,
    timestamp: Date.now()
  })}\n\n`;

  const encoder = new TextEncoder();
  const encodedMessage = encoder.encode(message);

  for (const [clientId, controller] of clients.entries()) {
    try {
      controller.enqueue(encodedMessage);
    } catch (error) {
      clients.delete(clientId);
    }
  }
}