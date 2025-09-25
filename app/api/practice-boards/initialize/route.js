import { NextResponse } from 'next/server';
import { db, getEnvironment } from '../../../../lib/dynamodb.js';
import { validateUserSession } from '../../../../lib/auth-check.js';
import { validateCSRFToken } from '../../../../lib/csrf.js';



export const dynamic = 'force-dynamic';
export async function POST(request) {
  try {
    console.log('[PRACTICE-BOARDS-INIT] API called');
    
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid || !validation.user.isAdmin) {
      console.log('[PRACTICE-BOARDS-INIT] Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[PRACTICE-BOARDS-INIT] User authorized:', validation.user.email);

    // DSR: Industry-standard CSRF protection with double-submit cookie pattern
    const csrfToken = request.headers.get('x-csrf-token');
    const csrfCookie = request.cookies.get('csrf-token');
    
    if (!validateCSRFToken(csrfToken, process.env.CSRF_SECRET, csrfCookie?.value)) {
      console.log('[PRACTICE-BOARDS-INIT] CSRF token validation failed');
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    console.log('[PRACTICE-BOARDS-INIT] CSRF validation passed');

    // Get all users with practice_manager role
    console.log('[PRACTICE-BOARDS-INIT] Fetching all users...');
    const allUsers = await db.getAllUsers();
    console.log('[PRACTICE-BOARDS-INIT] Total users found:', allUsers.length);
    
    const practiceManagers = allUsers.filter(user => user.role === 'practice_manager' && user.practices && user.practices.length > 0);
    console.log('[PRACTICE-BOARDS-INIT] Practice managers found:', practiceManagers.length);
    console.log('[PRACTICE-BOARDS-INIT] Practice managers:', practiceManagers.map(pm => ({ name: pm.name, email: pm.email, practices: pm.practices })));
    
    const results = [];
    
    for (const manager of practiceManagers) {
      try {
        // Create practice board ID from sorted practices
        const practiceId = manager.practices.sort().join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');
        console.log('[PRACTICE-BOARDS-INIT] Processing manager:', manager.name, 'practiceId:', practiceId);
        
        // Check if board already exists using DSR-compliant naming
        const environment = getEnvironment();
        const boardKey = `${environment}_practice_board_${practiceId}`;
        console.log('[PRACTICE-BOARDS-INIT] Board key:', boardKey);
        
        const existingBoard = await db.getSetting(boardKey);
        console.log('[PRACTICE-BOARDS-INIT] Existing board found:', !!existingBoard);
        
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
          
          const saveResult = await db.saveSetting(boardKey, JSON.stringify(defaultBoard));
          console.log('[PRACTICE-BOARDS-INIT] Board save result:', saveResult);
          
          results.push({
            manager: manager.name,
            email: manager.email,
            practices: manager.practices,
            practiceId,
            status: 'created'
          });
          console.log('[PRACTICE-BOARDS-INIT] Board created for:', manager.name);
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
    
    console.log('[PRACTICE-BOARDS-INIT] Final results:', results);
    console.log('[PRACTICE-BOARDS-INIT] Boards created:', results.filter(r => r.status === 'created').length);
    
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