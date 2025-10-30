const clients = new Set();

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const client = { controller };
      clients.add(client);

      controller.enqueue(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

      return () => {
        clients.delete(client);
      };
    },
    cancel() {
      // Client disconnected
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

export function notifyWebexMessagesUpdate() {
  const message = `data: ${JSON.stringify({ type: 'webex_messages_updated' })}\n\n`;
  clients.forEach(client => {
    try {
      client.controller.enqueue(message);
    } catch (error) {
      clients.delete(client);
    }
  });
}
