import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Make clients Map more persistent and add debugging
let clients;
if (!global.sseClients) {
  console.log('Initializing new SSE clients Map');
  global.sseClients = new Map();
}
clients = global.sseClients;

// Debug logging
console.log(`SSE clients Map status: ${clients.size} channels, keys: [${Array.from(clients.keys()).join(', ')}]`);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const issueId = searchParams.get('issueId') || 'all';
  
  console.log(`SSE connection request for: ${issueId}`);

  const stream = new ReadableStream({
    start(controller) {
      const clientId = Date.now().toString();
      console.log(`New SSE client connecting for channel: ${issueId}, clientId: ${clientId}`);
      
      // Store client connection
      if (!clients.has(issueId)) {
        clients.set(issueId, new Set());
        console.log(`Created new client set for channel: ${issueId}`);
      }
      
      // Special logging for 'all' channel
      if (issueId === 'all') {
        console.log(`Homepage client ${clientId} connecting to 'all' channel`);
        console.log(`Total clients in 'all' channel after connection: ${clients.get('all')?.size || 0}`);
      }
      const clientObj = { controller, clientId };
      clients.get(issueId).add(clientObj);
      console.log(`Added client ${clientId} to channel: ${issueId}. Total clients: ${clients.get(issueId).size}`);
      
      // Extra logging for 'all' channel
      if (issueId === 'all') {
        console.log(`'all' channel now has ${clients.get('all').size} connected clients`);
        console.log(`All current channels:`, Array.from(clients.keys()));
      }
      
      // Send initial connection message
      const connectMsg = { type: 'connected', clientId };
      controller.enqueue(`data: ${JSON.stringify(connectMsg)}\n\n`);
      
      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          if (!controller.desiredSize || controller.desiredSize <= 0) {
            console.log(`Controller closed for client ${clientId}, stopping heartbeat`);
            clearInterval(heartbeat);
            return;
          }
          const heartbeatMsg = `: heartbeat ${Date.now()}\n\n`;
          controller.enqueue(heartbeatMsg);
        } catch (error) {
          console.log(`Heartbeat error for client ${clientId}:`, error.message);
          clearInterval(heartbeat);
        }
      }, 30000);
      
      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        console.log(`Client ${clientId} disconnecting from issueId: ${issueId}`);
        clearInterval(heartbeat);
        const issueClients = clients.get(issueId);
        if (issueClients) {
          issueClients.delete(clientObj);
          console.log(`Removed client ${clientId}. Remaining clients for ${issueId}: ${issueClients.size}`);
          if (issueClients.size === 0) {
            clients.delete(issueId);
            console.log(`Deleted empty client set for issueId: ${issueId}`);
          }
        }
      });
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no',
      'Content-Encoding': 'identity',
      'Transfer-Encoding': 'identity'
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
        // Check if controller is still writable
        if (!clientObj.controller.desiredSize || clientObj.controller.desiredSize <= 0) {
          console.log(`Controller closed for client ${clientObj.clientId}, marking as dead`);
          deadClients.push(clientObj);
          return;
        }
        
        // Send as event-stream format
        const message = `event: ${data.type}\ndata: ${JSON.stringify(data)}\n\n`;
        clientObj.controller.enqueue(message);
        
        console.log(`✅ Message sent to client ${clientObj.clientId} on channel ${issueId}`);
        console.log(`📤 Event type: ${data.type}`);
        
        if (data.type === 'assignment_created' || data.type === 'assignment_updated') {
          console.log(`🔄 Assignment notification sent: ${data.type} for assignment ${data.assignmentId}`);
        }
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