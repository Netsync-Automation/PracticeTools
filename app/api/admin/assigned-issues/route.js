import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';
import { validateUserSession } from '../../../../lib/auth-check';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid || !validation.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = validation.user;
    const allIssues = await db.getAllIssues();
    
    // Return all issues that have been assigned to any admin
    const assignedIssues = allIssues.filter(issue => 
      issue.assigned_to && issue.assigned_to.trim() !== ''
    );
    
    return NextResponse.json({ issues: assignedIssues });
  } catch (error) {
    console.error('Error fetching assigned issues:', error);
    return NextResponse.json({ error: 'Failed to fetch assigned issues' }, { status: 500 });
  }
}