import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb.js';

export async function GET() {
  try {
    console.log('🔍 [API] Starting practice board list');
    
    // Get all practice board settings
    const allSettings = await db.getAllSettings();
    console.log('🔍 [API] Total settings found:', Object.keys(allSettings).length);
    
    const practiceBoards = [];
    const boardKeys = Object.keys(allSettings).filter(key => key.startsWith('practice_board_'));
    console.log('🔍 [API] Practice board keys found:', boardKeys);
    
    for (const [key, value] of Object.entries(allSettings)) {
      if (key.startsWith('practice_board_') && key !== 'practice_board_data') {
        const practiceId = key.replace('practice_board_', '');
        console.log('🔍 [API] Processing board key:', key, 'practiceId:', practiceId);
        
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
    
    console.log('🔍 [API] Final practice boards list:', practiceBoards);
    return NextResponse.json({ boards: practiceBoards });
  } catch (error) {
    console.error('🔍 [API] Error listing practice boards:', error);
    return NextResponse.json({ error: 'Failed to list practice boards' }, { status: 500 });
  }
}