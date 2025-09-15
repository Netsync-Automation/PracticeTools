import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';

export const dynamic = 'force-dynamic';

export async function PUT(request, { params }) {
  try {
    const { email } = params;
    const { name, role, auth_method, created_from, isAdmin, practices, region } = await request.json();
    
    console.log('Updating user:', { email, name, role, auth_method, created_from, region, isAdmin, practices });
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    
    const updates = {};
    if (name) updates.name = name;
    if (role) updates.role = role;
    if (auth_method) updates.auth_method = auth_method;
    if (created_from) updates.created_from = created_from;
    if (typeof isAdmin === 'boolean') updates.isAdmin = isAdmin;
    if (practices) updates.practices = practices;
    if (region !== undefined) updates.region = region;
    
    console.log('Updates object:', updates);
    
    // Auto-activate staged users when they get assigned role and practices
    const currentUser = await db.getUser(decodeURIComponent(email));
    if (currentUser && currentUser.status === 'staged' && role && (practices && practices.length > 0 || role === 'netsync_employee')) {
      updates.status = 'active';
    }
    
    // Ensure account managers without region are staged
    if (role === 'account_manager' && !region) {
      updates.status = 'staged';
    } else if (role === 'account_manager' && region && currentUser?.status === 'staged') {
      updates.status = 'active';
    }
    
    const success = await db.updateUser(decodeURIComponent(email), updates);
    
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: `Internal server error: ${error.message}` }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { email } = params;
    const decodedEmail = decodeURIComponent(email);
    
    // Prevent deletion of system default users
    if (decodedEmail === 'admin@localhost') {
      return NextResponse.json({ error: 'Cannot delete system default admin user' }, { status: 403 });
    }
    
    // Check if user is system default
    const user = await db.getUser(decodedEmail);
    if (user && user.created_from === 'system_default') {
      return NextResponse.json({ error: 'Cannot delete system default user' }, { status: 403 });
    }
    
    const success = await db.deleteUser(decodedEmail);
    
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}