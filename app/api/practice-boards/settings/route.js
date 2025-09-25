import { NextResponse } from 'next/server';
import { db, getEnvironment } from '../../../../lib/dynamodb.js';
import { validateUserSession } from '../../../../lib/auth-check.js';


export const dynamic = 'force-dynamic';
export async function POST(request) {
  try {
    console.log('🔧 [API] Saving board settings request received');
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      console.log('❌ [API] Unauthorized user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { practiceId, settings } = await request.json();
    console.log('📊 [API] Request data:', { practiceId, settings });
    
    if (!practiceId) {
      console.log('❌ [API] No practice ID provided');
      return NextResponse.json({ error: 'Practice ID required' }, { status: 400 });
    }

    // Get existing board data using DSR compliant environment-aware key
    const environment = getEnvironment();
    const boardKey = `${environment}_practice_board_${practiceId}`;
    const existingBoard = await db.getSetting(boardKey);
    console.log('📋 [API] Board lookup for key:', boardKey, 'found:', !!existingBoard);
    
    if (!existingBoard) {
      console.log('❌ [API] Board not found for key:', boardKey);
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    const boardData = JSON.parse(existingBoard);
    console.log('📋 [API] Current board data:', boardData);
    
    // Check permissions
    const user = validation.user;
    const canEdit = user.isAdmin || 
      (user.role === 'practice_manager' || user.role === 'practice_principal') && 
      boardData.practices?.some(practice => user.practices?.includes(practice));
    
    console.log('🔐 [API] Permission check:', { canEdit, userRole: user.role, isAdmin: user.isAdmin });
    
    if (!canEdit) {
      console.log('❌ [API] Insufficient permissions');
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Update board settings
    boardData.settings = { ...boardData.settings, ...settings };
    console.log('⚙️ [API] Updated board data:', boardData);
    
    await db.saveSetting(boardKey, JSON.stringify(boardData));
    console.log('✅ [API] Board settings saved to DSR compliant key:', boardKey);
    
    // Send SSE notification for settings updated
    try {
      const { notifyClients } = await import('../../events/route.js');
      notifyClients(`practice-board-${practiceId}`, {
        type: 'settings_updated',
        settings: boardData.settings,
        timestamp: Date.now()
      });
    } catch (sseError) {
      console.error('SSE notification failed:', sseError);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ [API] Error saving board settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    console.log('📊 [API] Loading board settings request received');
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      console.log('❌ [API] Unauthorized user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const practiceId = searchParams.get('practiceId');
    console.log('🔍 [API] Loading settings for practice ID:', practiceId);
    
    if (!practiceId) {
      console.log('❌ [API] No practice ID provided');
      return NextResponse.json({ error: 'Practice ID required' }, { status: 400 });
    }

    // DSR compliant environment-aware key
    const environment = getEnvironment();
    const boardKey = `${environment}_practice_board_${practiceId}`;
    const existingBoard = await db.getSetting(boardKey);
    console.log('📋 [API] DSR compliant board lookup for key:', boardKey, 'found:', !!existingBoard);
    
    if (!existingBoard) {
      console.log('📋 [API] No board found for key:', boardKey, 'returning empty settings');
      return NextResponse.json({ settings: {} });
    }

    const boardData = JSON.parse(existingBoard);
    const settings = boardData.settings || {};
    console.log('⚙️ [API] Returning settings:', settings);
    
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('❌ [API] Error loading board settings:', error);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}