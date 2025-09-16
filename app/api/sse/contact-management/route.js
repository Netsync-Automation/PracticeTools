import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      // Initialize SSE clients map if it doesn't exist
      if (!global.sseClients) {
        global.sseClients = new Map();
      }
      
      const channel = 'contact-management';
      const clientId = Date.now() + Math.random();
      
      // Get or create clients set for this channel
      if (!global.sseClients.has(channel)) {
        global.sseClients.set(channel, new Set());
      }
      
      const clients = global.sseClients.get(channel);
      const clientObj = { controller, clientId };
      clients.add(clientObj);
      
      // Send initial connection message
      const initialMessage = `data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`;
      controller.enqueue(encoder.encode(initialMessage));
      
      // Clean up on close
      request.signal.addEventListener('abort', () => {
        clients.delete(clientObj);
        if (clients.size === 0) {
          global.sseClients.delete(channel);
        }
      });
    }
  });

  return new NextResponse(stream, {
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