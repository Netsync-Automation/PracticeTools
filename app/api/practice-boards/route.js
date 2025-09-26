import { NextResponse } from 'next/server';
import { db, getEnvironment } from '../../../lib/dynamodb.js';
import { getCached, setCached, clearCache } from '../../../lib/cache.js';
import { validateUserSession } from '../../../lib/auth-check.js';


export const dynamic = 'force-dynamic';
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const practiceId = searchParams.get('practiceId');
    const topic = searchParams.get('topic') || 'Main Topic';
    
    if (practiceId) {
      // Get specific practice board for topic - DSR compliant with environment prefix
      const environment = getEnvironment();
      const boardKey = topic === 'Main Topic' 
        ? `${environment}_practice_board_${practiceId}` 
        : `${environment}_practice_board_${practiceId}_${topic.replace(/[^a-zA-Z0-9]/g, '_')}`;
      
      // Check cache first
      const cacheKey = `board_${boardKey}`;
      const cached = getCached(cacheKey);
      if (cached) {
        return NextResponse.json(cached);
      }
      
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
        
        const response = { columns };
        setCached(cacheKey, response, 30000); // Cache for 30 seconds
        return NextResponse.json(response);
      }

      const response = JSON.parse(boardData);
      
      // Normalize card data to ensure all required fields exist
      if (response.columns) {
        response.columns = response.columns.map(column => ({
          ...column,
          cards: (column.cards || []).map(card => ({
            ...card,
            followers: card.followers || [],
            comments: card.comments || [],
            attachments: card.attachments || []
          }))
        }));
      }
      
      setCached(cacheKey, response, 30000); // Cache for 30 seconds
      return NextResponse.json(response);
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
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { practiceId, topic = 'Main Topic', columns } = await request.json();
    
    // DSR: Check if user can edit this board
    const user = validation.user;
    if (!user.isAdmin) {
      // Get board data to check practices
      const environment = getEnvironment();
      const boardKey = topic === 'Main Topic' 
        ? `${environment}_practice_board_${practiceId}` 
        : `${environment}_practice_board_${practiceId}_${topic.replace(/[^a-zA-Z0-9]/g, '_')}`;
      
      const existingData = await db.getSetting(boardKey);
      if (existingData) {
        const boardData = JSON.parse(existingData);
        const canEdit = boardData.practices && user.practices && 
          boardData.practices.some(practice => user.practices.includes(practice));
        
        if (!canEdit) {
          return NextResponse.json({ error: 'You can only edit boards for your assigned practices' }, { status: 403 });
        }
      }
    }
    
    // DSR compliant board key with environment prefix
    const environment = getEnvironment();
    const boardKey = topic === 'Main Topic' 
      ? `${environment}_practice_board_${practiceId}` 
      : `${environment}_practice_board_${practiceId}_${topic.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
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
      // Clear cache for this board - use DSR compliant key
      clearCache(`board_${environment}_practice_board_${practiceId}`);
      
      // Send SSE notification for board updates
      try {
        const { notifyClients } = await import('../events/route.js');
        
        // Normalize columns data for SSE notification
        const normalizedColumns = columns.map(column => ({
          ...column,
          cards: (column.cards || []).map(card => ({
            ...card,
            followers: card.followers || [],
            comments: card.comments || [],
            attachments: card.attachments || []
          }))
        }));
        
        notifyClients(`practice-board-${practiceId}`, {
          type: 'board_updated',
          columns: normalizedColumns,
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