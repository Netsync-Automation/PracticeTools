import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    console.log('\n=== FOLLOWS API CALLED ===');
    const userCookie = request.cookies.get('user-session');
    
    if (!userCookie) {
      console.log('❌ No user session cookie found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = JSON.parse(userCookie.value);
    console.log('👤 User requesting follows:', user.email);
    
    // Get all issues the user is following
    console.log('🔍 Calling db.getUserFollows for:', user.email);
    const userFollows = await db.getUserFollows(user.email);
    console.log('📊 getUserFollows returned:', userFollows.length, 'follows');
    console.log('📋 Follow details:', JSON.stringify(userFollows, null, 2));
    
    console.log('✅ Returning follows to frontend');
    return NextResponse.json({ follows: userFollows });
  } catch (error) {
    console.error('Error fetching user follows:', error);
    return NextResponse.json({ error: 'Failed to fetch follows' }, { status: 500 });
  }
}