import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';
import { validateUserSession } from '../../../../lib/auth-check';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    console.log('[API] /api/admin/users - Starting user fetch request');
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      console.log('[API] /api/admin/users - Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = validation.user;
    console.log('[API] /api/admin/users - User validated:', user.email, 'Role:', user.role, 'IsAdmin:', user.isAdmin);
    
    // Allow admins full access, practice managers/principals filtered access
    if (user.isAdmin) {
      console.log('[API] /api/admin/users - Admin user, fetching all users');
      const users = await db.getAllUsers();
      console.log('[API] /api/admin/users - Retrieved', users?.length || 0, 'users from database');
      return NextResponse.json({ users });
    } else if (user.role === 'practice_manager' || user.role === 'practice_principal') {
      console.log('[API] /api/admin/users - Practice manager/principal, fetching all users');
      const allUsers = await db.getAllUsers();
      console.log('[API] /api/admin/users - Retrieved', allUsers?.length || 0, 'users from database');
      // For practice managers/principals, they can see all users but filtering will be applied on frontend
      // This allows them to manage users within their practice teams
      return NextResponse.json({ users: allUsers });
    } else {
      console.log('[API] /api/admin/users - Insufficient permissions for role:', user.role);
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
  } catch (error) {
    console.error('[API] /api/admin/users - Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid || !validation.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { email, name, role, practices, isAdmin, status } = await request.json();
    
    // Auto-create practice board when practice manager is assigned
    if (role === 'practice_manager' && practices && practices.length > 0) {
      try {
        const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/practice-boards/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ practices, managerId: email })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('Practice board creation result:', result);
        }
      } catch (error) {
        console.error('Error auto-creating practice board:', error);
        // Don't fail user creation if board creation fails
      }
    }
    
    const success = await db.createOrUpdateUser(
      email,
      name,
      'saml',
      role,
      null,
      'manual',
      false,
      isAdmin,
      practices,
      status
    );
    
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Failed to create/update user' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error creating/updating user:', error);
    return NextResponse.json({ error: 'Failed to create/update user' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid || !validation.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { email, updates } = await request.json();
    
    // Auto-create practice board when practice manager is assigned
    if (updates.role === 'practice_manager' && updates.practices && updates.practices.length > 0) {
      try {
        const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/practice-boards/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ practices: updates.practices, managerId: email })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('Practice board creation result:', result);
        }
      } catch (error) {
        console.error('Error auto-creating practice board:', error);
        // Don't fail user update if board creation fails
      }
    }
    
    const success = await db.updateUser(email, updates);
    
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}