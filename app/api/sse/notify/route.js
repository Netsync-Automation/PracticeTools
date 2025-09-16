import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Global clients map for SSE connections
const saToAmClients = new Map();

export async function POST(request) {
  try {
    const { type, practiceGroupId } = await request.json();
    
    if (type === 'sa-to-am-mapping-update' && practiceGroupId) {
      // Notify all clients listening to this practice group
      for (const [clientId, client] of saToAmClients.entries()) {
        if (client.practiceGroupId === practiceGroupId) {
          try {
            client.controller.enqueue(
              `data: ${JSON.stringify({ type, practiceGroupId })}\n\n`
            );
          } catch (error) {
            // Client disconnected, remove from map
            saToAmClients.delete(clientId);
          }
        }
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending SSE notification:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}

// Export clients for use by SSE endpoint
export { saToAmClients };