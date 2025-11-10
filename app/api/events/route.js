import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Initialize clients map safely
if (typeof global.sseClients === 'undefined') {
  global.sseClients = new Map();
}
const clients = global.sseClients;



export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const issueId = searchParams.get('issueId') || 'all';
  
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      const clientId = Date.now().toString();
      
      if (!clients.has(issueId)) {
        clients.set(issueId, new Set());
      }
      
      const clientObj = { controller, clientId };
      clients.get(issueId).add(clientObj);
      
      // Send initial connection message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`));
      
      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);
      
      // Cleanup on disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        clients.get(issueId)?.delete(clientObj);
        if (clients.get(issueId)?.size === 0) {
          clients.delete(issueId);
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
      'Access-Control-Allow-Headers': 'Cache-Control'
    },
  });
}

// Debug function to check current clients
export function getClientInfo() {
  const info = {};
  clients.forEach((clientSet, channelId) => {
    info[channelId] = Array.from(clientSet).map(c => c.clientId);
  });
  return info;
}

export function notifyClients(issueId, data) {
  const issueClients = clients.get(issueId);
  if (!issueClients) return;
  
  const deadClients = [];
  const encoder = new TextEncoder();
  const message = `event: ${data.type}\ndata: ${JSON.stringify(data)}\n\n`;
  
  issueClients.forEach((clientObj) => {
    try {
      clientObj.controller.enqueue(encoder.encode(message));
    } catch (error) {
      deadClients.push(clientObj);
    }
  });
  
  deadClients.forEach(deadClient => issueClients.delete(deadClient));
  
  if (issueClients.size === 0) {
    clients.delete(issueId);
  }
}