import { NextResponse } from 'next/server';
import { db, getEnvironment } from '../../../lib/dynamodb.js';
import { getCached, setCached, clearCache } from '../../../lib/cache.js';
import { validateUserSession } from '../../../lib/auth-check.js';

// DSR: Helper function to infer practices from practiceId
function inferPracticesFromId(practiceId) {
  const practiceMap = {
    'audiovisual-collaboration-contactcenter-iot-physicalsecurity': ['Audio Visual', 'Collaboration'],
    'audiovisual': ['Audio Visual'],
    'collaboration': ['Collaboration'],
    'security': ['Security'],
    'datacenter': ['Data Center'],
    'networking': ['Networking'],
    'cloud': ['Cloud'],
    'wireless': ['Wireless'],
    'contactcenter': ['Contact Center'],
    'iot': ['IoT'],
    'physicalsecurity': ['Physical Security']
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
  
  // If no matches found, try to parse the practiceId directly
  if (practices.length === 0) {
    const parts = practiceId.split('-');
    for (const part of parts) {
      if (practiceMap[part]) {
        practices.push(...practiceMap[part]);
      }
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
        // Return default columns if no board exists
        const columns = [
          { id: 'backlog', title: 'Backlog', cards: [], createdBy: 'system', createdAt: new Date().toISOString() },
          { id: 'in-progress', title: 'In Progress', cards: [], createdBy: 'system', createdAt: new Date().toISOString() },
          { id: 'review', title: 'Review', cards: [], createdBy: 'system', createdAt: new Date().toISOString() },
          { id: 'done', title: 'Done', cards: [], createdBy: 'system', createdAt: new Date().toISOString() }
        ];
        
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
      return NextResponse.json({ boards: [] });
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
        console.log('[PRACTICE-BOARDS-DEBUG] User practices:', user.practices);
        console.log('[PRACTICE-BOARDS-DEBUG] User role:', user.role);
        
        // DSR: Enhanced permission check for practice principals and managers
        let canEdit = false;
        
        if (boardData.practices && user.practices) {
          // Check for direct practice match
          canEdit = boardData.practices.some(practice => user.practices.includes(practice));
          
          // DSR: Additional check for practice principals - they can edit boards for their practice
          if (!canEdit && (user.role === 'practice_principal' || user.role === 'practice_manager')) {
            // Check if user's practice matches any board practice (case-insensitive)
            canEdit = boardData.practices.some(boardPractice => 
              user.practices.some(userPractice => 
                boardPractice.toLowerCase().replace(/[^a-z]/g, '') === userPractice.toLowerCase().replace(/[^a-z]/g, '')
              )
            );
          }
          
          // DSR: Fallback - if board practices is empty or undefined, infer from practiceId
          if (!canEdit && (!boardData.practices || boardData.practices.length === 0)) {
            const inferredPractices = inferPracticesFromId(practiceId);
            console.log('[PRACTICE-BOARDS-DEBUG] Inferred practices from ID:', inferredPractices);
            canEdit = inferredPractices.some(practice => 
              user.practices.some(userPractice => 
                practice.toLowerCase().replace(/[^a-z]/g, '') === userPractice.toLowerCase().replace(/[^a-z]/g, '')
              )
            );
          }
        }
        
        console.log('[PRACTICE-BOARDS-DEBUG] Can edit board:', canEdit);
        
        if (!canEdit) {
          console.log('[PRACTICE-BOARDS-DEBUG] User cannot edit this board - insufficient permissions');
          return NextResponse.json({ 
            error: 'You can only edit boards for your assigned practices',
            debug: {
              userPractices: user.practices,
              boardPractices: boardData.practices,
              userRole: user.role,
              practiceId: practiceId
            }
          }, { status: 403 });
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
        console.log('[PRACTICE-BOARDS-DEBUG] Inferred practices for new board:', boardData.practices);
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