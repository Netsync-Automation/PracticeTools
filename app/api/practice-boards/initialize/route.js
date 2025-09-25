import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb.js';
import { validateUserSession } from '../../../../lib/auth-check.js';
import { validateCSRFToken } from '../../../../lib/csrf.js';



export const dynamic = 'force-dynamic';
export async function POST(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid || !validation.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // DSR: Industry-standard CSRF protection with double-submit cookie pattern
    const csrfToken = request.headers.get('x-csrf-token');
    const csrfCookie = request.cookies.get('csrf-token');
    
    if (!validateCSRFToken(csrfToken, process.env.CSRF_SECRET, csrfCookie?.value)) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    // Get all users with practice_manager role
    const allUsers = await db.getAllUsers();
    const practiceManagers = allUsers.filter(user => user.role === 'practice_manager' && user.practices && user.practices.length > 0);
    
    const results = [];
    
    for (const manager of practiceManagers) {
      try {
        // Create practice board ID from sorted practices
        const practiceId = manager.practices.sort().join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');
        
        // Check if board already exists using DSR-compliant naming
        const boardKey = `${db.getEnvironment()}_practice_board_${practiceId}`;
        const existingBoard = await db.getSetting(boardKey);
        
        if (!existingBoard) {
          // Create new board with default columns
          const defaultBoard = {
            columns: [
              { id: '1', title: 'To Do', cards: [], createdBy: 'system', createdAt: new Date().toISOString() },
              { id: '2', title: 'In Progress', cards: [], createdBy: 'system', createdAt: new Date().toISOString() },
              { id: '3', title: 'Done', cards: [], createdBy: 'system', createdAt: new Date().toISOString() }
            ],
            practices: manager.practices,
            managerId: manager.email,
            createdAt: new Date().toISOString()
          };
          
          await db.saveSetting(boardKey, JSON.stringify(defaultBoard));
          
          results.push({
            manager: manager.name,
            email: manager.email,
            practices: manager.practices,
            practiceId,
            status: 'created'
          });
        } else {
          results.push({
            manager: manager.name,
            email: manager.email,
            practices: manager.practices,
            practiceId,
            status: 'already_exists'
          });
        }
      } catch (error) {
        results.push({
          manager: manager.name,
          email: manager.email,
          practices: manager.practices,
          status: 'error',
          error: error.message
        });
      }
    }
    
    return NextResponse.json({ 
      success: true,
      practiceManagersFound: practiceManagers.length,
      results
    });
  } catch (error) {
    console.error('Error initializing practice boards:', error);
    return NextResponse.json({ error: 'Failed to initialize practice boards' }, { status: 500 });
  }
}