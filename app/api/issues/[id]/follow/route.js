import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/dynamodb';
import { validateUserSession } from '../../../../../lib/auth-check';
import { validateIssueAccess } from '../../../../../lib/access-control';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const issue = await db.getIssueById(params.id);
    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }
    
    const accessValidation = validateIssueAccess(issue, validation.user, 'view');
    if (!accessValidation.success) {
      return NextResponse.json({ error: accessValidation.error }, { status: accessValidation.statusCode });
    }
    
    const result = await db.followIssue(params.id, validation.user.email);
    
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
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ following: false });
    }
    
    const issue = await db.getIssueById(params.id);
    if (!issue) {
      return NextResponse.json({ following: false });
    }
    
    const accessValidation = validateIssueAccess(issue, validation.user, 'view');
    if (!accessValidation.success) {
      return NextResponse.json({ following: false });
    }
    
    console.log(`Checking follow status for user ${validation.user.email} on issue ${params.id}`);
    const following = await db.isUserFollowingIssue(params.id, validation.user.email);
    console.log(`Follow status result: ${following}`);
    
    return NextResponse.json({ following });
  } catch (error) {
    console.error('Check follow status error:', error);
    return NextResponse.json({ following: false });
  }
}