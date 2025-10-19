import { NextResponse } from 'next/server';
import { DynamoDBService } from '../../../../lib/dynamodb.js';

const db = new DynamoDBService();

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    
    if (!email) {
      return NextResponse.json({ error: 'Email parameter required' }, { status: 400 });
    }

    // Get user data
    const user = await db.getUser(email);
    
    if (!user) {
      return NextResponse.json({ 
        error: 'User not found',
        email: email
      }, { status: 404 });
    }

    // Get all practice info pages
    const boards = await db.getPracticeInfoPages();
    
    // Analyze permissions for each board
    const boardAnalysis = boards.map(board => {
      const userPractices = user.practices || [];
      const boardPractices = board.practices || [];
      
      // Check if user has matching practice
      const hasMatchingPractice = userPractices.some(userPractice => 
        boardPractices.includes(userPractice)
      );
      
      // Check role-based permissions
      const isPrincipal = user.role === 'practice_principal';
      const isManager = user.role === 'practice_manager';
      const hasRoleAccess = isPrincipal || isManager;
      
      return {
        boardId: board.id,
        boardName: board.name,
        boardPractices: boardPractices,
        hasMatchingPractice: hasMatchingPractice,
        hasRoleAccess: hasRoleAccess,
        canEdit: hasMatchingPractice && hasRoleAccess
      };
    });

    return NextResponse.json({
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
        practices: user.practices || []
      },
      boardAnalysis: boardAnalysis,
      summary: {
        totalBoards: boards.length,
        editableBoards: boardAnalysis.filter(b => b.canEdit).length
      }
    });

  } catch (error) {
    console.error('User analysis error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}