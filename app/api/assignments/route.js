import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb';
import { validateUserSession } from '../../../lib/auth-check';
import { uploadFileToS3 } from '../../../lib/s3';


export const dynamic = 'force-dynamic';
export async function GET(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const assignments = await db.getAllAssignments();
    
    return NextResponse.json({
      success: true,
      assignments: assignments
    });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch assignments' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const formData = await request.formData();
    
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
    
    // Parse notification users if provided
    let notificationUsers = [];
    try {
      const notificationUsersData = formData.get('notificationUsers');
      if (notificationUsersData) {
        notificationUsers = JSON.parse(notificationUsersData);
      }
    } catch (error) {
      console.error('Error parsing notification users:', error);
    }
    
    const assignmentId = await db.addAssignment(
      formData.get('practice'),
      formData.get('status') || 'Active',
      formData.get('projectNumber'),
      formData.get('requestDate'),
      formData.get('eta'),
      formData.get('customerName'),
      formData.get('projectDescription'),
      formData.get('region'),
      formData.get('am'),
      formData.get('pm'),
      formData.get('resourceAssigned'),
      formData.get('dateAssigned'),
      formData.get('notes') || '',
      formData.get('documentationLink') || '',
      formData.get('pmEmail') || '',
      attachments,
      notificationUsers
    );

    if (assignmentId) {
      const assignment = await db.getAssignmentById(assignmentId);
      
      // Send SSE notification for assignment creation
      try {
        const { notifyClients } = await import('../events/route');
        notifyClients('all', {
          type: 'assignment_created',
          assignmentId: assignmentId,
          assignment: assignment,
          timestamp: Date.now()
        });
      } catch (sseError) {
        console.error('Failed to send SSE notification:', sseError);
      }
      
      return NextResponse.json({
        success: true,
        assignment
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to create assignment' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error creating assignment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create assignment' },
      { status: 500 }
    );
  }
}