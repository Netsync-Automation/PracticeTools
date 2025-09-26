import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';
import { validateUserSession } from '../../../../lib/auth-check';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    console.log('[API] /api/practice-boards/users - Starting user fetch for practice board assignment');
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      console.log('[API] /api/practice-boards/users - Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = validation.user;
    console.log('[API] /api/practice-boards/users - User validated:', user.email, 'Role:', user.role, 'Practices:', user.practices);
    
    // DSR: Allow all authenticated users to access user list for assignment purposes
    // This is needed for practice members to assign users to cards
    const allUsers = await db.getAllUsers();
    console.log('[API] /api/practice-boards/users - Retrieved', allUsers?.length || 0, 'users from database');
    
    // Filter and sort users for practice board context
    const filteredUsers = allUsers.filter(u => u.status === 'active');
    
    // Sort users: current user first, then practice members, then others
    const sortedUsers = filteredUsers.sort((a, b) => {
      const aIsCurrentUser = a.email === user.email;
      const bIsCurrentUser = b.email === user.email;
      
      // Current user always first
      if (aIsCurrentUser && !bIsCurrentUser) return -1;
      if (!aIsCurrentUser && bIsCurrentUser) return 1;
      
      // Then by name/email alphabetically
      return (a.name || a.email).localeCompare(b.name || b.email);
    });
    
    console.log('[API] /api/practice-boards/users - Returning', sortedUsers.length, 'filtered users');
    return NextResponse.json({ users: sortedUsers });
  } catch (error) {
    console.error('[API] /api/practice-boards/users - Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}