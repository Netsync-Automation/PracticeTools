import { NextResponse } from 'next/server';
import { db, getEnvironment } from '../../../../lib/dynamodb.js';
import { validateUserSession } from '../../../../lib/auth-check.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get('boardId');
    
    if (!boardId) {
      return NextResponse.json({ error: 'Board ID required' }, { status: 400 });
    }

    const environment = getEnvironment();
    const permissionsKey = `${environment}_personal_board_permissions_${boardId}`;
    const permissionsData = await db.getSetting(permissionsKey);
    
    const permissions = permissionsData ? JSON.parse(permissionsData) : { invitedUsers: [] };
    
    return NextResponse.json({ permissions });
  } catch (error) {
    console.error('Error fetching board permissions:', error);
    return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { boardId, invitedUsers } = await request.json();
    const user = validation.user;
    
    if (!boardId) {
      return NextResponse.json({ error: 'Board ID required' }, { status: 400 });
    }

    const personalBoardId = `personal_${user.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
    if (boardId !== personalBoardId) {
      return NextResponse.json({ error: 'Can only manage your own board' }, { status: 403 });
    }

    const environment = getEnvironment();
    const permissionsKey = `${environment}_personal_board_permissions_${boardId}`;
    
    const permissionsData = {
      boardId,
      ownerEmail: user.email,
      invitedUsers: invitedUsers || [],
      updatedAt: new Date().toISOString()
    };

    const success = await db.saveSetting(permissionsKey, JSON.stringify(permissionsData));
    
    if (success) {
      try {
        const { notifyClients } = await import('../../events/route.js');
        notifyClients(`practice-board-${boardId}`, {
          type: 'permissions_updated',
          boardId,
          timestamp: Date.now()
        });
      } catch (sseError) {
        console.error('SSE notification failed:', sseError);
      }
      
      return NextResponse.json({ success: true, permissions: permissionsData });
    } else {
      return NextResponse.json({ error: 'Failed to save permissions' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error saving board permissions:', error);
    return NextResponse.json({ error: 'Failed to save permissions' }, { status: 500 });
  }
}
