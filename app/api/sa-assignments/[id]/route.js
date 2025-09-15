import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';
import { validateUserSession } from '../../../../lib/auth-check';
import { etaTracker } from '../../../../lib/eta-tracker';
import { saEmailService } from '../../../../lib/sa-email-service';
import { saWebexService } from '../../../../lib/sa-webex-service';

export async function GET(request, { params }) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const saAssignment = await db.getSaAssignmentById(params.id);
    
    if (!saAssignment) {
      return NextResponse.json({ error: 'SA assignment not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      saAssignment
    });
  } catch (error) {
    console.error('Error fetching SA assignment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch SA assignment' },
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
    
    const updates = await request.json();
    
    // Get current assignment for ETA tracking
    const currentAssignment = await db.getSaAssignmentById(params.id);
    if (!currentAssignment) {
      return NextResponse.json({ error: 'SA assignment not found' }, { status: 404 });
    }
    
    const oldStatus = currentAssignment.status;
    const newStatus = updates.status;
    
    // Add timestamps for status changes
    const timestamp = new Date().toISOString();
    if (newStatus && newStatus !== oldStatus) {
      if (newStatus === 'Unassigned') {
        updates.unassignedAt = timestamp;
      } else if (newStatus === 'Assigned') {
        updates.assignedAt = timestamp;
      } else if (newStatus === 'Completed') {
        updates.completedAt = timestamp;
      }
    }
    
    const success = await db.updateSaAssignment(params.id, updates);
    
    if (success) {
      // Track status change for ETA calculations
      if (newStatus && newStatus !== oldStatus) {
        const updatedAssignment = { ...currentAssignment, ...updates };
        await etaTracker.trackStatusChange(updatedAssignment, oldStatus, newStatus, timestamp);
      }
      
      // Send email notifications for status changes
      if (newStatus && newStatus !== oldStatus) {
        try {
          const updatedAssignment = await db.getSaAssignmentById(params.id);
          
          if (newStatus === 'Pending') {
            await saEmailService.sendPendingSAAssignmentNotification(updatedAssignment);
          } else if (newStatus === 'Unassigned' && updatedAssignment.practice && updatedAssignment.practice !== 'Pending') {
            await saEmailService.sendPracticeAssignedNotification(updatedAssignment);
          } else if (newStatus === 'Assigned' && updatedAssignment.saAssigned) {
            // Create Webex space first, then send email with space ID
            try {
              const spaceId = await saWebexService.createSASpace(updatedAssignment);
              if (spaceId) {
                // Get updated assignment with space ID for email
                const finalAssignment = await db.getSaAssignmentById(params.id);
                await saEmailService.sendSAAssignedNotification(finalAssignment);
              } else {
                // Send email without space ID if creation failed
                await saEmailService.sendSAAssignedNotification(updatedAssignment);
              }
            } catch (webexError) {
              console.error('Failed to create Webex space for SA assignment:', webexError);
              // Send email without space ID if Webex fails
              await saEmailService.sendSAAssignedNotification(updatedAssignment);
            }
          }
        } catch (emailError) {
          console.error('Failed to send SA assignment status change email:', emailError);
          // Don't fail the request if email fails
        }
      }
      
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to update SA assignment' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error updating SA assignment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update SA assignment' },
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
    
    // Get SA assignment details before deletion for Webex cleanup
    const saAssignment = await db.getSaAssignmentById(params.id);
    
    const success = await db.deleteSaAssignment(params.id);
    
    if (success) {
      // Clean up Webex space if it exists
      if (saAssignment && saAssignment.webex_space_id) {
        try {
          await saWebexService.removeAllUsersFromSpace(saAssignment);
        } catch (webexError) {
          console.error('Failed to clean up Webex space during SA assignment deletion:', webexError);
          // Don't fail the request if Webex cleanup fails
        }
      }
      
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to delete SA assignment' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error deleting SA assignment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete SA assignment' },
      { status: 500 }
    );
  }
}