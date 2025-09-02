import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/dynamodb';
import { uploadFileToS3 } from '../../../../../lib/s3';
import { validateUserSession } from '../../../../../lib/auth-check';

export async function GET(request, { params }) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const comments = await db.getAssignmentComments(params.id);
    
    return NextResponse.json({ comments });
  } catch (error) {
    console.error('Error fetching assignment comments:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const formData = await request.formData();
    const message = formData.get('message');
    
    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }
    
    // Handle file uploads
    const attachments = [];
    const files = formData.getAll('attachments');
    
    for (const file of files) {
      if (file.size > 0) {
        try {
          const buffer = Buffer.from(await file.arrayBuffer());
          const s3Key = await uploadFileToS3(buffer, file.name);
          attachments.push({
            filename: file.name,
            path: s3Key,
            size: file.size
          });
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
        }
      }
    }
    
    const commentId = await db.addAssignmentComment(
      params.id,
      validation.user.email,
      validation.user.name,
      message.trim(),
      attachments,
      validation.user.isAdmin
    );
    
    if (commentId) {
      // Send SSE notification for new assignment comment
      try {
        const { notifyClients } = await import('../../../events/route');
        notifyClients('all', {
          type: 'assignment_comment_added',
          assignmentId: params.id,
          commentId: commentId,
          timestamp: Date.now()
        });
        notifyClients(params.id, {
          type: 'assignment_comment_added',
          assignmentId: params.id,
          commentId: commentId,
          timestamp: Date.now()
        });
      } catch (sseError) {
        console.error('SSE notification failed:', sseError);
      }
      
      return NextResponse.json({ success: true, commentId });
    } else {
      return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error adding assignment comment:', error);
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });
  }
}