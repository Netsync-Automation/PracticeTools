import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';
import { validateUserSession } from '../../../../lib/auth-check';

export async function GET(request, { params }) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const saAssignment = await db.getSaAssignmentById(params.id);
    
    if (!saAssignment) {
      return NextResponse.json({ error: 'SA assignment not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      saAssignment
    });
  } catch (error) {
    console.error('Error fetching SA assignment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch SA assignment' },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const updates = await request.json();
    const success = await db.updateSaAssignment(params.id, updates);
    
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to update SA assignment' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error updating SA assignment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update SA assignment' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const success = await db.deleteSaAssignment(params.id);
    
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to delete SA assignment' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error deleting SA assignment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete SA assignment' },
      { status: 500 }
    );
  }
}