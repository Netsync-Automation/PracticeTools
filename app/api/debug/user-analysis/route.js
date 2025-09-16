import { NextResponse } from 'next/server';
import { validateUserSession } from '../../../../lib/auth-check.js';

export const dynamic = 'force-dynamic';
import { db } from '../../../../lib/dynamodb.js';

export async function GET(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = validation.user;
    
    // Get all practice boards
    const allSettings = await db.getAllSettings();
    const practiceBoards = [];
    
    Object.keys(allSettings).forEach(key => {
      if (key.startsWith('practice_board_')) {
        try {
          const boardData = JSON.parse(allSettings[key]);
          const boardId = key.replace('practice_board_', '');
          practiceBoards.push({
            id: boardId,
            practices: boardData.practices || [],
            managerId: boardData.managerId || 'unknown',
            createdAt: boardData.createdAt || 'unknown'
          });
        } catch (error) {
          console.error(`Error parsing board ${key}:`, error);
        }
      }
    });

    // Find matching boards for this user
    const userPractices = user.practices || [];
    const matchingBoards = practiceBoards.filter(board => {
      return board.practices && board.practices.some(practice => userPractices.includes(practice));
    });

    // Expected board ID based on user practices
    const expectedBoardId = userPractices.length > 0 
      ? userPractices.sort().join('-').toLowerCase().replace(/[^a-z0-9-]/g, '')
      : null;

    const analysis = {
      timestamp: new Date().toISOString(),
      environment: process.env.ENVIRONMENT || 'unknown',
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
        isAdmin: user.isAdmin,
        practices: userPractices,
        auth_method: user.auth_method,
        created_from: user.created_from,
        status: user.status
      },
      practiceBoards: {
        total: practiceBoards.length,
        all: practiceBoards,
        matching: matchingBoards,
        expectedBoardId,
        hasExpectedBoard: practiceBoards.some(board => board.id === expectedBoardId)
      },
      permissions: {
        canAddTopics: user.role === 'practice_principal' || user.role === 'practice_manager' || user.isAdmin,
        canViewBoards: userPractices.length > 0 || user.isAdmin,
        roleCheck: {
          isPracticePrincipal: user.role === 'practice_principal',
          isPracticeManager: user.role === 'practice_manager',
          isAdmin: user.isAdmin
        }
      },
      debugging: {
        userPracticesString: userPractices.join(', '),
        userPracticesSorted: userPractices.sort().join(', '),
        boardIdGeneration: {
          input: userPractices.sort(),
          joined: userPractices.sort().join('-'),
          lowercased: userPractices.sort().join('-').toLowerCase(),
          cleaned: userPractices.sort().join('-').toLowerCase().replace(/[^a-z0-9-]/g, '')
        }
      }
    };

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Error in user analysis:', error);
    return NextResponse.json({ 
      error: 'Analysis failed', 
      details: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}