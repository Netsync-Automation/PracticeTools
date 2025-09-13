import { NextResponse } from 'next/server';
import { saToAmClients } from '../notify/route.js';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const practiceGroupId = searchParams.get('practiceGroupId');
  
  if (!practiceGroupId) {
    return new NextResponse('Practice Group ID required', { status: 400 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const clientId = Date.now().toString();
      
      // Store client connection in shared map
      saToAmClients.set(clientId, { controller, practiceGroupId });
      
      // Send initial connection message
      controller.enqueue(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
      
      // Clean up on disconnect
      request.signal?.addEventListener('abort', () => {
        saToAmClients.delete(clientId);
        try {
          controller.close();
        } catch (e) {
          // Controller already closed
        }
      });
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}