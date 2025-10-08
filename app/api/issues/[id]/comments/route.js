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
    
    const comments = await db.getComments(params.id);
    return NextResponse.json({ comments });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const formData = await request.formData();
    const message = formData.get('message');
    const userCookie = request.cookies.get('user-session');
    
    if (!userCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Validate user session
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if issue is closed and prevent comments for all users
    const issue = await db.getIssueById(params.id);
    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }
    
    // Validate access for Leadership Questions
    const { validateIssueAccess } = await import('../../../../../lib/access-control');
    const accessValidation = validateIssueAccess(issue, validation.user, 'comment');
    if (!accessValidation.success) {
      return NextResponse.json({ error: accessValidation.error }, { status: accessValidation.statusCode });
    }
    
    if (issue.status === 'Closed') {
      return NextResponse.json({ error: 'Cannot add comments to closed issues' }, { status: 403 });
    }
    
    // Handle file uploads first to check if we have attachments
    const attachments = [];
    const files = formData.getAll('attachments');
    
    for (const file of files) {
      if (file.size > 0) {
        try {
          const { uploadFileToS3 } = await import('../../../../../lib/s3');
          const buffer = Buffer.from(await file.arrayBuffer());
          const s3Key = await uploadFileToS3(buffer, file.name);
          attachments.push({
            filename: file.name,
            path: s3Key,
            size: file.size
          });
        } catch (error) {
          console.error('File upload error:', error);
        }
      }
    }
    
    // Require either message or attachments
    if ((!message || message.trim().length === 0) && attachments.length === 0) {
      return NextResponse.json({ error: 'Message or attachment is required' }, { status: 400 });
    }
    

    
    const user = validation.user;
    
    console.log('Adding comment for issue:', params.id, 'by user:', user.email);
    const commentMessage = message ? message.trim() : '';
    const commentId = await db.addComment(params.id, user.email, user.name, commentMessage, attachments, user.isAdmin);
    
    if (commentId) {
      console.log('Comment added successfully:', commentId);
      
      // Auto-follow: Ensure commenter is following the issue
      try {
        console.log('Creating auto-follow record for commenter:', user.email);
        await db.ensureUserFollowing(params.id, user.email);
        console.log('Auto-follow record ensured for commenter');
      } catch (followError) {
        console.error('Error creating auto-follow for commenter:', followError);
      }
      
      // Send WebEx direct messages to conversation participants
      try {
        const { isWebexNotificationsEnabled } = await import('../../../../../lib/webex-check');
        const webexEnabled = await isWebexNotificationsEnabled();
        
        if (webexEnabled) {
          console.log('Attempting to send WebEx comment notifications...');
          const { WebexMultiRoomService } = await import('../../../../../lib/webex-multi-room');
          const issue = await db.getIssueById(params.id);
          const allComments = await db.getComments(params.id);
          
          console.log('Issue data:', { id: issue?.id, email: issue?.email, practice: issue?.practice });
          console.log('Comments count:', allComments?.length);
          console.log('Comment author:', { email: user.email, name: user.name });
          
          if (issue && allComments) {
            // DSR: Use multi-room service for Practice Issues notifications (Room 1)
            const result = await WebexMultiRoomService.sendIssueNotifications(issue, allComments, user);
            console.log('WebEx comment notification result:', result);
            
            console.log('WebEx comment notifications completed with follow status checking');
          } else {
            console.log('Missing issue or comments data for WebEx notification');
          }
        } else {
          console.log('WebEx notifications are disabled');
        }
      } catch (webexError) {
        console.error('WebEx DM notification failed:', webexError);
      }
      
      // Send SSE notification
      try {
        console.log(`Attempting to send SSE notification for issue ${params.id}, comment ${commentId}`);
        const { notifyClients } = await import('../../../events/route');
        console.log('SSE module imported successfully');
        
        console.log(`Sending SSE to issue channel: ${params.id}`);
        const result1 = notifyClients(params.id, { 
          type: 'comment_added', 
          commentId, 
          issueId: params.id,
          timestamp: Date.now()
        });
        console.log('SSE notification sent to specific issue:', result1);
        
        console.log('Sending SSE to all channel');
        const result2 = notifyClients('all', { 
          type: 'comment_added', 
          issueId: params.id, 
          commentId,
          timestamp: Date.now()
        });
        console.log('SSE notification sent to all clients:', result2);
        
        console.log('SSE notifications completed successfully');
      } catch (sseError) {
        console.error('SSE notification failed:', sseError);
        console.error('SSE error stack:', sseError.stack);
      }
      
      return NextResponse.json({ success: true, id: commentId });
    } else {
      console.error('Failed to add comment to database');
      return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error adding comment:', error);
    return NextResponse.json({ error: `Internal server error: ${error.message}` }, { status: 500 });
  }
}