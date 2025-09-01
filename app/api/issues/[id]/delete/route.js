import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/dynamodb';
import { validateUserSession } from '../../../../../lib/auth-check';

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    
    // Validate user session
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Get the issue to check permissions
    const issue = await db.getIssueById(id);
    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }
    
    // Check if user can delete (creator or admin)
    const canDelete = validation.user.email === issue.email || validation.user.isAdmin;
    if (!canDelete) {
      return NextResponse.json({ 
        error: 'Permission denied. Only the issue creator or admin can delete this issue.' 
      }, { status: 403 });
    }
    
    // Delete the issue
    const success = await db.deleteIssue(id);
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete issue' }, { status: 500 });
    }
    
    // Send SSE notification
    try {
      const { notifyClients } = await import('../../../events/route');
      notifyClients('all', {
        type: 'issue_deleted',
        issueId: id,
        issueNumber: issue.issue_number
      });
    } catch (sseError) {
      console.error('SSE notification failed:', sseError);
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Issue deleted successfully' 
    });
    
  } catch (error) {
    console.error('Error deleting issue:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}