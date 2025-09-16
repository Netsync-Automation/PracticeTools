import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';

import { validateUserSession } from '../../../../lib/auth-check';
import { validateComment, sanitizeInput } from '../../../../lib/input-validator';
import { logger } from '../../../../lib/safe-logger';
import { WebexNotifications } from '../../../../lib/webex-notifications';


export const dynamic = 'force-dynamic';
export async function POST(request) {
  try {
    // Validate user session
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const issueId = sanitizeInput(formData.get('issueId'));
    const description = formData.get('description');
    const userEmail = sanitizeInput(formData.get('userEmail'));
    
    if (!issueId || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate and sanitize comment
    const commentValidation = validateComment(description);
    if (!commentValidation.isValid) {
      return NextResponse.json({ error: commentValidation.errors[0] }, { status: 400 });
    }

    // Get the existing issue
    const issue = await db.getIssueById(issueId);
    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }

    // Process attachments using the same method as comments
    let attachments = [];
    const attachmentFiles = formData.getAll('attachments');
    
    if (attachmentFiles && attachmentFiles.length > 0) {
      for (const file of attachmentFiles) {
        if (file.size > 0) {
          try {
            const { uploadFileToS3 } = await import('../../../../lib/s3');
            const buffer = Buffer.from(await file.arrayBuffer());
            const s3Key = await uploadFileToS3(buffer, file.name);
            attachments.push({
              filename: file.name,
              path: s3Key,
              size: file.size
            });
          } catch (uploadError) {
            logger.error('File upload failed during merge', { error: uploadError.message });
          }
        }
      }
    }

    // Create comment message (attachments handled separately like in comments)
    let commentMessage = `**Merged from duplicate submission:**\n\n${commentValidation.sanitized}`;
    
    // Add attachment note if attachments exist
    if (attachments.length > 0) {
      commentMessage += `\n\n*${attachments.length} attachment${attachments.length > 1 ? 's' : ''} merged from duplicate submission*`;
    }

    // Add comment to existing issue
    const commentId = await db.addComment(
      issueId,
      userEmail,
      validation.user.name,
      commentMessage,
      attachments,
      validation.user.isAdmin
    );

    if (!commentId) {
      return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });
    }

    // Upvote the existing issue
    const upvoteResult = await db.upvoteIssue(issueId, userEmail);
    if (!upvoteResult.success && !upvoteResult.alreadyUpvoted) {
      logger.error('Failed to upvote during merge', { issueId, userEmail });
    }

    // Ensure user is following the issue
    await db.ensureUserFollowing(issueId, userEmail);

    // Send SSE notifications for real-time updates
    try {
      const { notifyClients } = await import('../../events/route');
      
      // Get updated issue data
      const updatedIssue = await db.getIssueById(issueId);
      const comments = await db.getComments(issueId);
      
      // Notify about new comment
      notifyClients('all', {
        type: 'comment_added',
        issueId: issueId,
        comment: {
          id: commentId,
          user_email: userEmail,
          user_name: validation.user.name,
          message: commentMessage,
          attachments: JSON.stringify(attachments),
          is_admin: validation.user.isAdmin,
          created_at: new Date().toISOString()
        },
        timestamp: Date.now()
      });

      // Notify about upvote update
      notifyClients('all', {
        type: 'upvote_updated',
        issueId: issueId,
        upvotes: updatedIssue.upvotes,
        userEmail: userEmail,
        upvoted: true,
        timestamp: Date.now()
      });

      // Notify about follow status
      notifyClients('all', {
        type: 'follow_updated',
        issueId: issueId,
        userEmail: userEmail,
        following: true,
        timestamp: Date.now()
      });

      // Send WebEx notification for comment
      try {
        await WebexNotifications.sendCommentNotifications(updatedIssue, comments, validation.user);
      } catch (webexError) {
        logger.error('WebEx notification failed during merge', { error: webexError.message });
      }

    } catch (sseError) {
      logger.error('SSE notification failed during merge', { error: sseError.message });
    }

    logger.info('Issue merge completed successfully', { 
      issueId, 
      userEmail, 
      commentAdded: !!commentId,
      upvoted: upvoteResult.success || upvoteResult.alreadyUpvoted,
      attachments: attachments.length 
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Successfully merged with existing issue',
      commentId,
      upvoted: upvoteResult.success || upvoteResult.alreadyUpvoted,
      following: true
    });

  } catch (error) {
    logger.error('Error merging duplicate issue', { error: error.message });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}