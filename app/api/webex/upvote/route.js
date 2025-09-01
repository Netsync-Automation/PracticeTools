import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';

export async function POST(request) {
  try {
    const { issue_id, user_email } = await request.json();
    
    if (!issue_id || !user_email) {
      return NextResponse.json({ error: 'Issue ID and user email required' }, { status: 400 });
    }
    
    const result = await db.upvoteIssue(issue_id, user_email);
    
    if (result.success) {
      const issue = await db.getIssueById(issue_id);
      return NextResponse.json({ 
        success: true, 
        upvotes: issue?.upvotes || 0,
        message: 'Upvote recorded successfully!'
      });
    } else {
      return NextResponse.json({ 
        success: false,
        error: result.alreadyUpvoted ? 'You can only upvote an issue once' : 'Failed to upvote',
        upvotes: (await db.getIssueById(issue_id))?.upvotes || 0
      });
    }
  } catch (error) {
    console.error('WebEx upvote error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}