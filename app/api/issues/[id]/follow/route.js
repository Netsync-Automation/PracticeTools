import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/dynamodb';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const userCookie = request.cookies.get('user-session');
    
    if (!userCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = JSON.parse(userCookie.value);
    const result = await db.followIssue(params.id, user.email);
    
    return NextResponse.json({ 
      success: true, 
      following: result.following,
      message: result.following ? 'Following issue' : 'Unfollowed issue'
    });
  } catch (error) {
    console.error('Follow issue error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request, { params }) {
  try {
    const userCookie = request.cookies.get('user-session');
    
    if (!userCookie) {
      return NextResponse.json({ following: false });
    }
    
    const user = JSON.parse(userCookie.value);
    console.log(`Checking follow status for user ${user.email} on issue ${params.id}`);
    const following = await db.isUserFollowingIssue(params.id, user.email);
    console.log(`Follow status result: ${following}`);
    
    return NextResponse.json({ following });
  } catch (error) {
    console.error('Check follow status error:', error);
    return NextResponse.json({ following: false });
  }
}