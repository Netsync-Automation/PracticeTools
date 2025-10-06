import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';
import { validateUserSession } from '../../../../lib/auth-check';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const practice = searchParams.get('practice');
    
    const settings = await db.getTrainingCertsSettings(practice);
    
    return NextResponse.json({
      success: true,
      settings: settings || (practice ? { vendors: [], levels: [], types: [] } : {})
    });
  } catch (error) {
    console.error('Error fetching training certs settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user has admin/manager permissions
    if (!validation.user.isAdmin && 
        validation.user.role !== 'practice_manager' && 
        validation.user.role !== 'practice_principal') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    const { practice, settings } = await request.json();
    
    if (!practice) {
      return NextResponse.json(
        { success: false, error: 'Practice is required' },
        { status: 400 }
      );
    }
    
    const success = await db.updateTrainingCertsSettings(practice, settings);
    
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to update settings' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error updating training certs settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}