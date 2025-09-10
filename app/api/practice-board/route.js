import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb.js';

export async function GET() {
  try {
    const boardData = await db.getSetting('practice_board_data');
    
    if (!boardData) {
      return NextResponse.json({
        columns: [
          { id: '1', title: 'To Do', cards: [] },
          { id: '2', title: 'In Progress', cards: [] },
          { id: '3', title: 'Done', cards: [] }
        ]
      });
    }

    return NextResponse.json(JSON.parse(boardData));
  } catch (error) {
    console.error('Error fetching board data:', error);
    return NextResponse.json({ error: 'Failed to fetch board data' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { columns } = await request.json();
    
    const success = await db.saveSetting('practice_board_data', JSON.stringify({ columns }));
    
    if (success) {
      // Send SSE notification for board updates
      try {
        const { notifyClients } = await import('../events/route.js');
        notifyClients('practice-board', {
          type: 'board_updated',
          columns: columns,
          timestamp: Date.now()
        });
      } catch (sseError) {
        console.error('SSE notification failed:', sseError);
      }
      
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Failed to save board data' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error saving board data:', error);
    return NextResponse.json({ error: 'Failed to save board data' }, { status: 500 });
  }
}