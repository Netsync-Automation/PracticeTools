import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';
import { validateUserSession } from '../../../../lib/auth-check';

export async function POST(request) {
  try {
    const { issueId } = await request.json();
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = validation.user;
    
    // Use existing upvote method
    const result = await db.upvoteIssue(issueId, user.email);
    
    if (result.success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ 
        error: result.alreadyUpvoted ? 'Already upvoted this issue' : 'Failed to upvote'
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Upvote duplicate error:', error);
    return NextResponse.json({ error: 'Failed to upvote issue' }, { status: 500 });
  }
}