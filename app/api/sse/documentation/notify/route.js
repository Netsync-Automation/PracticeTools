import { NextResponse } from 'next/server';
import { notifyDocumentationUpdate } from '../route.js';

export async function POST(request) {
  try {
    const { documentId, status } = await request.json();
    
    // Trigger SSE notification to all connected clients
    notifyDocumentationUpdate();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error triggering SSE notification:', error);
    return NextResponse.json({ error: 'Failed to notify' }, { status: 500 });
  }
}