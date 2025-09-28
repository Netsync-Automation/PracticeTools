import { NextResponse } from 'next/server';
import { db, getEnvironment } from '../../../lib/dynamodb.js';
import { getCached, setCached, clearCache } from '../../../lib/cache.js';
import { validateUserSession } from '../../../lib/auth-check.js';

// DSR: Helper function to infer practices from practiceId
function inferPracticesFromId(practiceId) {
  const practiceMap = {
    'audiovisual-collaboration-contactcenter-iot-physicalsecurity': ['Collaboration'],
    'collaboration': ['Collaboration'],
    'security': ['Security'],
    'datacenter': ['Data Center'],
    'networking': ['Networking'],
    'cloud': ['Cloud'],
    'wireless': ['Wireless']
  };
  
  // Direct match
  if (practiceMap[practiceId]) {
    return practiceMap[practiceId];
  }
  
  // Try to match parts of compound IDs
  const practices = [];
  for (const [key, value] of Object.entries(practiceMap)) {
    if (practiceId.includes(key) || key.includes(practiceId)) {
      practices.push(...value);
    }
  }
  
  return [...new Set(practices)]; // Remove duplicates
}


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
    console.log('[PRACTICE-BOARDS-DEBUG] POST request received');
    const userCookie = request.cookies.get('user-session');
    console.log('[PRACTICE-BOARDS-DEBUG] User cookie exists:', !!userCookie);
    
    const validation = await validateUserSession(userCookie);
    console.log('[PRACTICE-BOARDS-DEBUG] Session validation result:', {
      valid: validation.valid,
      error: validation.error,
      userEmail: validation.user?.email
    });
    
    if (!validation.valid) {
      console.log('[PRACTICE-BOARDS-DEBUG] Session validation failed:', validation.error);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { practiceId, topic = 'Main Topic', columns } = await request.json();
    console.log('[PRACTICE-BOARDS-DEBUG] Request data:', {
      practiceId,
      topic,
      columnsCount: columns?.length
    });
    
    // DSR: Check if user can edit this board
    const user = validation.user;
    console.log('[PRACTICE-BOARDS-DEBUG] User details:', {
      email: user?.email,
      isAdmin: user?.isAdmin,
      role: user?.role,
      practices: user?.practices
    });
    
    if (!user.isAdmin) {
      console.log('[PRACTICE-BOARDS-DEBUG] User is not admin, checking board permissions');
      // Get board data to check practices
      const environment = getEnvironment();
      const boardKey = topic === 'Main Topic' 
        ? `${environment}_practice_board_${practiceId}` 
        : `${environment}_practice_board_${practiceId}_${topic.replace(/[^a-zA-Z0-9]/g, '_')}`;
      
      console.log('[PRACTICE-BOARDS-DEBUG] Board key:', boardKey);
      const existingData = await db.getSetting(boardKey);
      console.log('[PRACTICE-BOARDS-DEBUG] Existing board data found:', !!existingData);
      
      if (existingData) {
        const boardData = JSON.parse(existingData);
        console.log('[PRACTICE-BOARDS-DEBUG] Board practices:', boardData.practices);
        const canEdit = boardData.practices && user.practices && 
          boardData.practices.some(practice => user.practices.includes(practice));
        console.log('[PRACTICE-BOARDS-DEBUG] Can edit board:', canEdit);
        
        if (!canEdit) {
          console.log('[PRACTICE-BOARDS-DEBUG] User cannot edit this board - insufficient permissions');
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
      
      // DSR: Ensure practices field exists for permission checking
      if (!boardData.practices || !Array.isArray(boardData.practices)) {
        // Infer practices from practiceId if missing
        boardData.practices = inferPracticesFromId(practiceId);
      }
    } else {
      // DSR: New board - ensure practices field is set
      boardData.practices = inferPracticesFromId(practiceId);
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
        console.log('[PRACTICE-BOARDS-DEBUG] SSE notification sent successfully');
      } catch (sseError) {
        console.error('[PRACTICE-BOARDS-DEBUG] SSE notification failed:', sseError);
      }
      
      console.log('[PRACTICE-BOARDS-DEBUG] Returning success response');
      return NextResponse.json({ success: true });
    } else {
      console.log('[PRACTICE-BOARDS-DEBUG] Failed to save board data');
      return NextResponse.json({ error: 'Failed to save practice board' }, { status: 500 });
    }
  } catch (error) {
    console.error('[PRACTICE-BOARDS-DEBUG] Error saving practice board:', error);
    console.error('[PRACTICE-BOARDS-DEBUG] Error stack:', error.stack);
    return NextResponse.json({ error: 'Failed to save practice board' }, { status: 500 });
  }
}