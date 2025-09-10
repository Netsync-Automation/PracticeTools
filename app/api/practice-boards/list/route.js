import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb.js';

export async function GET() {
  try {
    // Get all practice board settings
    const allSettings = await db.getAllSettings();
    const practiceBoards = [];
    
    for (const [key, value] of Object.entries(allSettings)) {
      if (key.startsWith('practice_board_') && key !== 'practice_board_data') {
        const practiceId = key.replace('practice_board_', '');
        
        // Skip topic-specific boards (they contain underscores after the practice ID)
        if (practiceId.includes('_')) {
          continue;
        }
        
        const boardData = JSON.parse(value);
        
        // Handle legacy boards that don't have practices field
        let practices = boardData.practices;
        if (!practices || practices.length === 0) {
          // Reconstruct practices from practiceId for legacy boards
          practices = practiceId.split('-').map(p => 
            p.split('').map((char, i) => i === 0 ? char.toUpperCase() : char).join('')
          );
        }
        
        console.log('📋 [LIST] Found board:', { key, practiceId, practices });
        practiceBoards.push({
          practiceId,
          practices,
          managerId: boardData.managerId,
          createdAt: boardData.createdAt
        });
      }
    }
    
    console.log('📋 [LIST] Returning boards:', practiceBoards.length, 'total');
    return NextResponse.json({ boards: practiceBoards });
  } catch (error) {
    console.error('Error listing practice boards:', error);
    return NextResponse.json({ error: 'Failed to list practice boards' }, { status: 500 });
  }
}