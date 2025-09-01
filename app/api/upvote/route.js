import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb';
import { validateUserSession } from '../../../lib/auth-check';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { issue_id } = await request.json();
    
    if (!issue_id) {
      return NextResponse.json({ error: 'Issue ID required' }, { status: 400 });
    }
    
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = validation.user;
    
    // Check if user is trying to upvote their own issue
    const issue = await db.getIssueById(issue_id);
    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }
    
    if (issue.email === user.email) {
      return NextResponse.json({ 
        error: 'You cannot upvote your own issue' 
      }, { status: 400 });
    }
    
    const result = await db.upvoteIssue(issue_id, user.email);
    
    if (result.success) {
      const issue = await db.getIssueById(issue_id);
      return NextResponse.json({ 
        success: true, 
        upvotes: issue?.upvotes || 0 
      });
    } else {
      return NextResponse.json({ 
        error: result.alreadyUpvoted ? 'You can only upvote an issue once' : 'Failed to upvote'
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error upvoting issue:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}