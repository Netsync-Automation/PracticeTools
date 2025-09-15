import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb.js';

export async function POST(request) {
  try {
    const { practices, managerId } = await request.json();
    
    if (!practices || !Array.isArray(practices) || practices.length === 0) {
      return NextResponse.json({ error: 'Practices array is required' }, { status: 400 });
    }

    // Create practice board ID from sorted practices
    const practiceId = practices.sort().join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');
    
    // Check if board already exists
    const existingBoard = await db.getSetting(`practice_board_${practiceId}`);
    
    if (!existingBoard) {
      // Get database-stored columns or use defaults
      const boardColumns = await db.getBoardColumns(practiceId);
      const columns = boardColumns.map(col => ({
        id: col.id,
        title: col.title,
        cards: [],
        createdBy: 'system',
        createdAt: new Date().toISOString()
      }));
      
      // Create new board with database-stored columns
      const defaultBoard = {
        columns,
        practices: practices,
        managerId: managerId,
        createdAt: new Date().toISOString()
      };
      
      await db.saveSetting(`practice_board_${practiceId}`, JSON.stringify(defaultBoard));
    }
    
    return NextResponse.json({ 
      success: true, 
      practiceId,
      created: !existingBoard 
    });
  } catch (error) {
    console.error('Error creating practice board:', error);
    return NextResponse.json({ error: 'Failed to create practice board' }, { status: 500 });
  }
}