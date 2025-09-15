import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const practiceId = searchParams.get('practiceId');
    const topic = searchParams.get('topic') || 'Main Topic';
    
    if (practiceId) {
      // Get specific practice board for topic
      const boardKey = topic === 'Main Topic' 
        ? `practice_board_${practiceId}` 
        : `practice_board_${practiceId}_${topic.replace(/[^a-zA-Z0-9]/g, '_')}`;
      
      const boardData = await db.getSetting(boardKey);
      
      if (!boardData) {
        // Get database-stored columns or use defaults
        const boardColumns = await db.getBoardColumns(practiceId);
        const columns = boardColumns.map(col => ({
          id: col.id,
          title: col.title,
          cards: [],
          createdBy: 'system',
          createdAt: new Date().toISOString()
        }));
        
        return NextResponse.json({ columns });
      }

      return NextResponse.json(JSON.parse(boardData));
    } else {
      // Get all practice boards
      try {
        const boards = await db.getAllPracticeBoards();
        return NextResponse.json({ boards });
      } catch (error) {
        return NextResponse.json({ boards: [], error: error.message });
      }
    }
  } catch (error) {
    console.error('Error fetching practice board:', error);
    return NextResponse.json({ error: 'Failed to fetch practice board' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { practiceId, topic = 'Main Topic', columns } = await request.json();
    
    const boardKey = topic === 'Main Topic' 
      ? `practice_board_${practiceId}` 
      : `practice_board_${practiceId}_${topic.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    // Get existing board data to preserve settings
    const existingData = await db.getSetting(boardKey);
    let boardData = { columns, topic, practiceId };
    
    if (existingData) {
      const parsed = JSON.parse(existingData);
      // Preserve existing settings (including background)
      boardData = {
        ...parsed,
        columns, // Update columns
        topic,   // Update topic
        practiceId // Update practiceId
      };
    }
    
    const success = await db.saveSetting(boardKey, JSON.stringify(boardData));
    
    if (success) {
      // Send SSE notification for board updates
      try {
        const { notifyClients } = await import('../events/route.js');
        notifyClients(`practice-board-${practiceId}`, {
          type: 'board_updated',
          columns: columns,
          topic: topic,
          timestamp: Date.now()
        });
      } catch (sseError) {
        console.error('SSE notification failed:', sseError);
      }
      
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Failed to save practice board' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error saving practice board:', error);
    return NextResponse.json({ error: 'Failed to save practice board' }, { status: 500 });
  }
}