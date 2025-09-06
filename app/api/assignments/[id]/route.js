import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';
import { validateUserSession } from '../../../../lib/auth-check';
import { uploadFileToS3 } from '../../../../lib/s3';

export async function GET(request, { params }) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const assignment = await db.getAssignmentById(params.id);
    
    if (!assignment) {
      return NextResponse.json(
        { success: false, error: 'Assignment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      assignment: assignment
    });
  } catch (error) {
    console.error('Error fetching assignment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch assignment' },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const contentType = request.headers.get('content-type');
    let updateData;
    
    if (contentType && contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      updateData = {};
      
      for (const [key, value] of formData.entries()) {
        if (key !== 'attachments' && key !== 'existingAttachments') {
          updateData[key] = value;
        }
      }
      
      const newAttachments = [];
      const files = formData.getAll('attachments');
      
      for (const file of files) {
        if (file.size > 0) {
          try {
            const buffer = Buffer.from(await file.arrayBuffer());
            const s3Key = await uploadFileToS3(buffer, file.name);
            newAttachments.push({
              filename: file.name,
              path: s3Key,
              size: file.size
            });
          } catch (error) {
            console.error(`Failed to upload ${file.name}:`, error);
          }
        }
      }
      
      const existingAttachments = JSON.parse(formData.get('existingAttachments') || '[]');
      const allAttachments = [...existingAttachments, ...newAttachments];
      updateData.attachments = JSON.stringify(allAttachments);
    } else {
      updateData = await request.json();
    }
    
    const success = await db.updateAssignment(params.id, updateData);
    
    if (success) {
      const assignment = await db.getAssignmentById(params.id);
      
      // Send SSE notification for assignment update
      try {
        const { notifyClients } = await import('../../events/route');
        notifyClients('all', {
          type: 'assignment_updated',
          assignmentId: params.id,
          assignment: assignment,
          timestamp: Date.now()
        });
      } catch (sseError) {
        console.error('Failed to send SSE notification:', sseError);
      }
      
      return NextResponse.json({
        success: true,
        assignment: assignment
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to update assignment' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error updating assignment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update assignment' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const success = await db.deleteAssignment(params.id);
    
    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Assignment deleted successfully'
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to delete assignment' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error deleting assignment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete assignment' },
      { status: 500 }
    );
  }
}