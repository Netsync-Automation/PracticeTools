import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { issueId, upvotes } = await request.json();
    
    // Send SSE notification to all clients
    const { notifyClients } = await import('../events/route');
    notifyClients('all', { 
      type: 'issue_upvoted', 
      issueId,
      upvotes
    });
    
    console.log(`SSE notification sent for upvote on issue ${issueId}, new count: ${upvotes}`);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending upvote notification:', error);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}