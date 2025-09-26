import { NextResponse } from 'next/server';
import { db } from '../../../../../../lib/dynamodb';
import { validateUserSession } from '../../../../../../lib/auth-check';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { practiceId, columnId } = await request.json();
    const cardKey = `${practiceId}_${columnId}_${params.cardId}`;
    
    console.log('🔄 POST Follow - cardId:', params.cardId, 'practiceId:', practiceId, 'columnId:', columnId);
    console.log('📝 Generated cardKey:', cardKey, 'email:', validation.user.email);
    
    const result = await db.followIssue(cardKey, validation.user.email);
    
    console.log('✅ Follow result:', result);
    
    return NextResponse.json({ 
      success: true, 
      following: result.following
    });
  } catch (error) {
    console.error('❌ Practice board follow error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request, { params }) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ following: false });
    }
    
    const { searchParams } = new URL(request.url);
    const practiceId = searchParams.get('practiceId');
    const columnId = searchParams.get('columnId');
    const cardKey = `${practiceId}_${columnId}_${params.cardId}`;
    
    console.log('🔍 GET Follow Status - cardId:', params.cardId, 'cardKey:', cardKey, 'email:', validation.user.email);
    
    const following = await db.isUserFollowingIssue(cardKey, validation.user.email);
    
    console.log('📊 Follow status result:', following);
    
    return NextResponse.json({ following });
  } catch (error) {
    console.error('❌ Check practice board follow status error:', error);
    return NextResponse.json({ following: false });
  }
}