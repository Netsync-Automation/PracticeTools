import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb.js';
import { validateUserSession } from '../../../../lib/auth-check.js';

export async function POST(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid || !validation.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all practice board and topic settings
    const allSettings = await db.getAllSettings();
    const deletedBoards = [];
    const deletedTopics = [];
    
    for (const [key, value] of Object.entries(allSettings)) {
      if (key.startsWith('practice_board_') && key !== 'practice_board_data') {
        try {
          await db.deleteSetting(key);
          deletedBoards.push(key);
        } catch (error) {
          console.error(`Error deleting ${key}:`, error);
        }
      } else if (key.startsWith('practice_topics_')) {
        try {
          await db.deleteSetting(key);
          deletedTopics.push(key);
        } catch (error) {
          console.error(`Error deleting ${key}:`, error);
        }
      }
    }
    
    return NextResponse.json({ 
      success: true,
      deletedBoardsCount: deletedBoards.length,
      deletedTopicsCount: deletedTopics.length,
      deletedBoards,
      deletedTopics
    });
  } catch (error) {
    console.error('Error deleting practice boards:', error);
    return NextResponse.json({ error: 'Failed to delete practice boards' }, { status: 500 });
  }
}