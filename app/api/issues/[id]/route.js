import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';
import { validateUserSession } from '../../../../lib/auth-check';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const issue = await db.getIssueById(params.id);
    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }
    return NextResponse.json({ issue });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch issue' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { status, title, description, problem_link, resolutionComment, assignedTo } = await request.json();
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = validation.user;
    const issue = await db.getIssueById(params.id);
    
    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }
    
    // Admin can update status
    if (user.isAdmin && status) {
      // Check if moving from Open status requires assignment
      if (issue.status === 'Open' && status !== 'Open' && !issue.assigned_to && !assignedTo) {
        return NextResponse.json({ 
          error: 'Assignment required', 
          message: 'Issues must be assigned to an admin before changing status from Open' 
        }, { status: 400 });
      }
      
      const success = await db.updateIssueStatus(params.id, status, user.name, resolutionComment);
      if (!success) {
        return NextResponse.json({ error: 'Failed to update issue' }, { status: 500 });
      }
    }
    
    // Admin can update assignment
    if (user.isAdmin && assignedTo !== undefined) {
      const success = await db.updateIssueAssignment(params.id, assignedTo, user.name);
      if (!success) {
        return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 });
      }
    }
    
    // Issue creator or admin can update title/description/problem_link
    if ((user.email === issue.email || user.isAdmin) && (title || description || problem_link !== undefined)) {
      const success = await db.updateIssueContent(
        params.id, 
        title || issue.title, 
        description || issue.description, 
        problem_link !== undefined ? problem_link : issue.problem_link
      );
      if (!success) {
        return NextResponse.json({ error: 'Failed to update issue' }, { status: 500 });
      }
    } else if ((title || description || problem_link !== undefined) && user.email !== issue.email && !user.isAdmin) {
      return NextResponse.json({ error: 'Only the issue creator or admin can edit issue content' }, { status: 403 });
    }
    
    const updatedIssue = await db.getIssueById(params.id);
    
    // Send WebEx adaptive card notification only for status changes
    if (status && status !== issue.status) {
      try {
        const { isWebexNotificationsEnabled } = await import('../../../../lib/webex-check');
        const webexEnabled = await isWebexNotificationsEnabled();
        
        if (webexEnabled) {
          console.log('Sending status update notification...');
          const { sendWebexCard, sendDirectMessage } = await import('../../../../lib/webex');
        const issueData = {
          id: params.id,
          issue_number: updatedIssue.issue_number,
          issue_type: updatedIssue.issue_type,
          title: updatedIssue.title,
          description: updatedIssue.description,
          problem_link: updatedIssue.problem_link,
          email: updatedIssue.email,
          status: status,
          practice: updatedIssue.practice,
          system: updatedIssue.system,
          upvotes: updatedIssue.upvotes || 0,
          attachments: updatedIssue.attachments,
          previous_status: issue.status,
          status_changed_by: user.name,
          resolutionComment: updatedIssue.resolution_comment || resolutionComment,
          assigned_to: updatedIssue.assigned_to,
          created_at: updatedIssue.created_at,
          updated_at: updatedIssue.updated_at
        };
        
        // Send room notification
        await sendWebexCard(issueData, 'updated');
        console.log('WebEx status update card sent');
        
        // Send direct message to issue creator and followers
        if (status === 'Closed') {
          await sendDirectMessage(issueData, 'updated');
          console.log('Direct message sent to issue creator');
          
          // Send to followers (including creators and commenters who haven't unfollowed)
          const issue = await db.getIssueById(params.id);
          const comments = await db.getComments(params.id);
          const allUsers = new Set([issue.email, ...comments.map(c => c.user_email)]);
          
          let notificationCount = 0;
          for (const userEmail of allUsers) {
            if (userEmail !== user.email) {
              const isFollowing = await db.isUserFollowingIssue(params.id, userEmail);
              if (isFollowing) {
                await sendDirectMessage({...issueData, email: userEmail}, 'updated');
                notificationCount++;
              }
            }
          }
          console.log(`Direct messages sent to ${notificationCount} followers`);
        }
        
          // Auto-sync WebEx users after status change
          try {
            const { WebexSync } = await import('../../../../lib/webex-sync');
            await WebexSync.syncOnAction();
          } catch (syncError) {
            console.error('Auto-sync failed:', syncError);
          }
        }
      } catch (webexError) {
        console.error('WebEx notification failed:', webexError);
      }
    }
    
    // Send SSE notification for any update (status or content)
    try {
      console.log(`Attempting to send SSE notification for issue update: ${params.id}`);
      const { notifyClients } = await import('../../events/route');
      
      // Send to specific issue page
      notifyClients(params.id, { type: 'issue_updated', issueId: params.id });
      
      // Send to homepage with update details
      const updateData = {
        type: 'issue_updated', 
        issueId: params.id,
        updates: {}
      };
      
      if (status) {
        updateData.updates.status = updatedIssue.status;
      }
      if (title) {
        updateData.updates.title = updatedIssue.title;
      }
      if (description) {
        updateData.updates.description = updatedIssue.description;
      }
      if (problem_link !== undefined) {
        updateData.updates.problem_link = updatedIssue.problem_link;
      }
      
      updateData.updates.last_updated_at = updatedIssue.last_updated_at;
      
      notifyClients('all', updateData);
      console.log(`SSE notification sent for issue update: ${params.id}`, updateData);
    } catch (sseError) {
      console.error('SSE notification failed:', sseError);
    }
    
    return NextResponse.json({ success: true, issue: updatedIssue });
  } catch (error) {
    console.error('Update issue error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}