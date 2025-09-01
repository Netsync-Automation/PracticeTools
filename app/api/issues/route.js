import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb';
import { uploadFileToS3 } from '../../../lib/s3';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const issues = await db.getAllIssues();
    return NextResponse.json({ issues });
  } catch (error) {
    console.error('Error fetching issues:', error);
    return NextResponse.json({ error: 'Failed to fetch issues' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    
    const type = formData.get('issue_type');
    const title = formData.get('title');
    const problemLink = formData.get('problem_link') || '';
    const description = formData.get('description');
    const email = formData.get('email');
    const practice = formData.get('practice') || '';
    const selectedLeadership = formData.get('selectedLeadership') ? JSON.parse(formData.get('selectedLeadership')) : [];
    
    // Validate input
    const errors = [];
    
    // Get valid issue types from database
    const validIssueTypes = await db.getIssueTypes();
    const validTypeNames = validIssueTypes.map(t => t.name);
    
    if (!validTypeNames.includes(type)) {
      errors.push('Invalid issue type');
    }
    if (!title || title.length > 100) {
      errors.push('Title must be 1-100 characters');
    }
    if (!description || description.length > 1000) {
      errors.push('Description must be 1-1000 characters');
    }
    if (!email || !email.includes('@')) {
      errors.push('Valid email required');
    }
    
    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
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
          errors.push(`Failed to upload ${file.name}: ${error.message}`);
        }
      }
    }
    
    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }
    
    const issueId = await db.addIssue(type, title, description, email, attachments, problemLink, practice, selectedLeadership);
    
    if (issueId) {
      // Send WebEx adaptive card notification
      try {
        const { isWebexNotificationsEnabled } = await import('../../../lib/webex-check');
        const webexEnabled = await isWebexNotificationsEnabled();
        
        if (webexEnabled) {
          const createdIssue = await db.getIssueById(issueId);
          
          if (createdIssue) {
            if (createdIssue.issue_type === 'Leadership Question') {
              // Send direct messages to creator and selected leadership
              const { sendDirectMessage } = await import('../../../lib/webex');
              
              // Send to issue creator
              await sendDirectMessage(createdIssue, 'created');
              
              // Send to selected leadership
              const selectedLeadership = createdIssue.selected_leadership || [];
              for (const leaderEmail of selectedLeadership) {
                const leaderIssue = { ...createdIssue, email: leaderEmail };
                await sendDirectMessage(leaderIssue, 'created');
              }
            } else {
              // Send to public space for all other issue types
              const { sendWebexCard } = await import('../../../lib/webex');
              await sendWebexCard(createdIssue, 'created');
            }
          }
        }
        
        // Auto-sync WebEx users after sending notification
        try {
          const { WebexSync } = await import('../../../lib/webex-sync');
          await WebexSync.syncOnAction();
        } catch (syncError) {
          // Silent error handling
        }
      } catch (webexError) {
        // Silent error handling
      }
      
      // Send SSE notification to all clients
      try {
        const { notifyClients } = await import('../events/route');
        notifyClients('all', { 
          type: 'issue_created', 
          issueId: issueId
        });
      } catch (sseError) {
        // Silent error handling
      }
      
      // Get the created issue to return issue number
      const createdIssue = await db.getIssueById(issueId);
      return NextResponse.json({ 
        success: true, 
        id: issueId,
        issue_number: createdIssue?.issue_number || 0
      });
    } else {
      return NextResponse.json({ error: 'Failed to save issue to database' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error creating issue:', error);
    return NextResponse.json({ error: `Internal server error: ${error.message}` }, { status: 500 });
  }
}