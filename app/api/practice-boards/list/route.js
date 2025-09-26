import { NextResponse } from 'next/server';
import { db, getEnvironment } from '../../../../lib/dynamodb.js';
import { validateUserSession } from '../../../../lib/auth-check.js';


export const dynamic = 'force-dynamic';
export async function GET(request) {
  try {
    console.log('🔍 [API] Starting practice board list');
    
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = validation.user;
    
    // Get all practice board settings - DSR compliant with environment prefix
    const environment = getEnvironment();
    const allSettings = await db.getAllSettingsAsObject();
    console.log('🔍 [API] Total settings found:', Object.keys(allSettings).length);
    
    const practiceBoards = [];
    const boardPrefix = `${environment}_practice_board_`;
    const boardKeys = Object.keys(allSettings).filter(key => key.startsWith(boardPrefix));
    console.log('🔍 [API] DSR compliant practice board keys found:', boardKeys);
    
    for (const [key, value] of Object.entries(allSettings)) {
      if (key.startsWith(boardPrefix) && key !== `${environment}_practice_board_data`) {
        const practiceId = key.replace(boardPrefix, '');
        console.log('🔍 [API] Processing DSR compliant board key:', key, 'practiceId:', practiceId);
        
        // Skip topic-specific boards (they contain underscores after the practice ID)
        if (practiceId.includes('_')) {
          console.log('🔍 [API] Skipping topic-specific board:', practiceId);
          continue;
        }
        
        try {
          const boardData = JSON.parse(value);
          console.log('🔍 [API] Parsed board data for', practiceId, ':', {
            practices: boardData.practices,
            managerId: boardData.managerId,
            createdAt: boardData.createdAt
          });
          
          // Handle legacy boards that don't have practices field
          let practices = boardData.practices;
          if (!practices || practices.length === 0) {
            console.log('🔍 [API] No practices found, reconstructing from practiceId:', practiceId);
            // Reconstruct practices from practiceId for legacy boards
            practices = practiceId.split('-').map(p => 
              p.split('').map((char, i) => i === 0 ? char.toUpperCase() : char).join('')
            );
            console.log('🔍 [API] Reconstructed practices:', practices);
          }
          
          const board = {
            practiceId,
            practices,
            managerId: boardData.managerId,
            createdAt: boardData.createdAt
          };
          
          practiceBoards.push(board);
          console.log('🔍 [API] Added board to list:', board);
        } catch (parseError) {
          console.error('🔍 [API] Error parsing board data for', key, ':', parseError);
        }
      }
    }
    
    console.log('🔍 [API] All practice boards found:', practiceBoards.length);
    
    // DSR: Mark user's owned boards and set permissions
    const boardsWithPermissions = practiceBoards.map(board => {
      const isOwned = board.practices && user.practices && 
        board.practices.some(practice => user.practices.includes(practice));
      
      return {
        ...board,
        isOwned,
        canEdit: user.isAdmin || isOwned,
        canCreateTopics: user.isAdmin || (user.role === 'practice_manager' || user.role === 'practice_principal')
      };
    });
    
    console.log('🔍 [API] Boards with permissions:', boardsWithPermissions.length);
    
    console.log('🔍 [API] Final practice boards list:', boardsWithPermissions.length);
    return NextResponse.json({ boards: boardsWithPermissions });
  } catch (error) {
    console.error('🔍 [API] Error listing practice boards:', error);
    return NextResponse.json({ error: 'Failed to list practice boards' }, { status: 500 });
  }
}