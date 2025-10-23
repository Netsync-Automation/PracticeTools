import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Initialize clients map safely
if (typeof global.sseClients === 'undefined') {
  global.sseClients = new Map();
}
const clients = global.sseClients;

// Debug logging
console.log(`SSE clients Map status: ${clients.size} channels, keys: [${Array.from(clients.keys()).join(', ')}]`);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const issueId = searchParams.get('issueId') || 'all';
  
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      const clientId = Date.now().toString();
      console.log(`New SSE client connecting for channel: ${issueId}, clientId: ${clientId}`);
      
      if (!clients.has(issueId)) {
        clients.set(issueId, new Set());
      }
      
      const clientObj = { controller, clientId };
      clients.get(issueId).add(clientObj);
      
      try {
        const connectMsg = `data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`;
        controller.enqueue(encoder.encode(connectMsg));
      } catch (error) {
        console.error(`Error sending initial message:`, error);
      }
      
      const heartbeat = setInterval(() => {
        try {
          const heartbeatMsg = `: heartbeat ${Date.now()}\n\n`;
          controller.enqueue(encoder.encode(heartbeatMsg));
        } catch (error) {
          clearInterval(heartbeat);
          cleanup();
        }
      }, 30000);
      
      const cleanup = () => {
        clearInterval(heartbeat);
        const issueClients = clients.get(issueId);
        if (issueClients) {
          issueClients.delete(clientObj);
          if (issueClients.size === 0) {
            clients.delete(issueId);
          }
        }
        try {
          controller.close();
        } catch (error) {
          console.log(`Controller close error:`, error.message);
        }
      };
      
      request.signal.addEventListener('abort', cleanup);
    },
    cancel() {
      console.log(`Stream cancelled for channel: ${issueId}`);
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
  console.log(`\n🔔 === SSE NOTIFICATION TRIGGERED ===`);
  console.log(`📡 Channel: ${issueId}`);
  console.log(`📋 Data:`, JSON.stringify(data, null, 2));
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log(`🗺️ Global clients map exists:`, !!global.sseClients);
  console.log(`🗺️ Local clients variable exists:`, !!clients);
  console.log(`🗺️ Clients map size:`, clients?.size || 0);
  console.log(`🗺️ All client channels:`, Array.from(clients?.keys() || []));
  
  // Special logging for 'all' channel
  if (issueId === 'all') {
    console.log(`🎯 Attempting to notify 'all' channel clients`);
    console.log(`🎯 'all' channel exists:`, clients.has('all'));
    console.log(`🎯 'all' channel client count:`, clients.get('all')?.size || 0);
    if (clients.get('all')) {
      console.log(`🎯 'all' channel client IDs:`, Array.from(clients.get('all')).map(c => c.clientId));
      console.log(`🎯 'all' channel client details:`, Array.from(clients.get('all')).map(c => ({
        clientId: c.clientId,
        hasController: !!c.controller,
        controllerDesiredSize: c.controller?.desiredSize
      })));
    }
  }
  
  const issueClients = clients.get(issueId);
  if (issueClients) {
    console.log(`Found ${issueClients.size} clients for channel: ${issueId}`);
    const deadClients = [];
    issueClients.forEach((clientObj) => {
      try {
        const message = `event: ${data.type}\ndata: ${JSON.stringify(data)}\n\n`;
        const encoder = new TextEncoder();
        clientObj.controller.enqueue(encoder.encode(message));
        console.log(`✅ Message sent to client ${clientObj.clientId} on channel ${issueId}`);
      } catch (error) {
        console.error(`Error sending to client ${clientObj.clientId}:`, error.message);
        deadClients.push(clientObj);
      }
    });
    
    // Remove dead clients
    deadClients.forEach(deadClient => {
      issueClients.delete(deadClient);
      console.log(`Removed dead client ${deadClient.clientId}`);
    });
    
    
    if (issueClients.size === 0) {
      clients.delete(issueId);
      console.log(`Deleted empty client set for channel: ${issueId}`);
    }
  } else {
    console.log(`No clients found for channel: ${issueId}`);
    if (issueId === 'all') {
      console.log(`'all' channel has no connected clients - homepage users not connected`);
    }
  }
}