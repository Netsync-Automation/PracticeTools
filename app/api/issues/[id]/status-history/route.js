import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/dynamodb';
import { validateUserSession } from '../../../../../lib/auth-check';
import { validateIssueAccess } from '../../../../../lib/access-control';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
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
    
    const history = await db.getStatusHistory(params.id);
    return NextResponse.json({ history });
  } catch (error) {
    console.error('Error fetching status history:', error);
    return NextResponse.json({ error: 'Failed to fetch status history' }, { status: 500 });
  }
}