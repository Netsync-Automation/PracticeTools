import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/dynamodb';
import { validateUserSession } from '../../../../../lib/auth-check';


export const dynamic = 'force-dynamic';
export async function GET(request, { params }) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const assignmentId = params.id;
    
    // Get status history for the assignment
    const history = await db.getAssignmentStatusHistory(assignmentId);
    
    return NextResponse.json({
      success: true,
      history: history
    });
  } catch (error) {
    console.error('Error fetching assignment status history:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch status history' },
      { status: 500 }
    );
  }
}