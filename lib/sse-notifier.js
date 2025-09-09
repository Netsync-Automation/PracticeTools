// SSE notification helper that works in both Next.js and standalone contexts
import { logger } from './safe-logger.js';

export async function sendSSENotification(channel, data) {
  try {
    // Check if we're in a Next.js runtime by looking for global SSE clients
    if (global.sseClients) {
      // We're in Next.js context, directly access the clients map
      const clients = global.sseClients;
      const issueClients = clients.get(channel);
      
      if (issueClients && issueClients.size > 0) {
        logger.info('Sending SSE notification directly', { channel, type: data.type, clientCount: issueClients.size });
        
        const deadClients = [];
        issueClients.forEach((clientObj) => {
          try {
            if (!clientObj.controller.desiredSize || clientObj.controller.desiredSize <= 0) {
              deadClients.push(clientObj);
              return;
            }
            
            const eventMessage = `event: ${data.type}\ndata: ${JSON.stringify(data)}\n\n`;
            const genericMessage = `data: ${JSON.stringify(data)}\n\n`;
            
            clientObj.controller.enqueue(eventMessage);
            clientObj.controller.enqueue(genericMessage);
          } catch (error) {
            logger.error('Error sending to SSE client', { error: error.message, clientId: clientObj.clientId });
            deadClients.push(clientObj);
          }
        });
        
        // Clean up dead clients
        deadClients.forEach(deadClient => {
          issueClients.delete(deadClient);
        });
        
        if (issueClients.size === 0) {
          clients.delete(channel);
        }
        
        logger.info('SSE notification sent successfully', { channel, type: data.type });
      } else {
        logger.info('No SSE clients connected for channel', { channel, type: data.type });
      }
    } else {
      logger.warn('SSE notification system not available - no global clients map');
    }
  } catch (error) {
    logger.error('Failed to send SSE notification', { 
      error: error.message,
      channel,
      type: data.type 
    });
  }
}