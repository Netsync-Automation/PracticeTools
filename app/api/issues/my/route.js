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
    
    const user = validation.user;
    const allIssues = await db.getAllIssues();
    
    // Filter issues to only show user's own issues
    const userIssues = allIssues.filter(issue => issue.email === user.email);
    
    return NextResponse.json({ issues: userIssues });
  } catch (error) {
    console.error('Error fetching user issues:', error);
    return NextResponse.json({ error: 'Failed to fetch issues' }, { status: 500 });
  }
}