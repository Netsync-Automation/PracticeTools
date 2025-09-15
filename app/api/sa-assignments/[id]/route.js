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
    let currentAssignment = await db.getSaAssignmentById(params.id);
    if (!currentAssignment) {
      return NextResponse.json({ error: 'SA assignment not found' }, { status: 404 });
    }
    
    const oldStatus = currentAssignment.status;
    const newStatus = updates.status;
    
    // Handle individual SA completion
    if (updates.markSAComplete && updates.targetSA) {
      const saCompletions = JSON.parse(currentAssignment.saCompletions || '{}');
      saCompletions[updates.targetSA] = {
        completedAt: new Date().toISOString(),
        completedBy: updates.targetSA
      };
      updates.saCompletions = JSON.stringify(saCompletions);
      
      // Check if all SAs are complete
      const allSAs = currentAssignment.saAssigned ? currentAssignment.saAssigned.split(',').map(s => s.trim()) : [];
      const completedSAs = Object.keys(saCompletions);
      const allComplete = allSAs.length > 0 && allSAs.every(sa => completedSAs.includes(sa));
      
      if (allComplete) {
        updates.status = 'Complete';
        updates.completedAt = new Date().toISOString();
        updates.completedBy = 'All SAs';
      }
      
      // Send Webex notification for SA completion update
      if (currentAssignment.webex_space_id) {
        try {
          const assignedPractices = currentAssignment.practice ? currentAssignment.practice.split(',').map(p => p.trim()).sort() : [];
          if (assignedPractices.length > 0) {
            const primaryPractice = assignedPractices[0];
            const webexBot = await db.getPracticeWebexBot(primaryPractice);
            
            if (webexBot && webexBot.accessToken) {
              const { saWebexService } = await import('../../../../lib/sa-webex-service.js');
              await saWebexService.sendSACompletionUpdate(
                currentAssignment.webex_space_id,
                { ...currentAssignment, ...updates, saCompletions: updates.saCompletions },
                webexBot.accessToken,
                updates.targetSA
              );
            }
          }
        } catch (webexError) {
          console.error('Failed to send Webex completion update:', webexError);
        }
      }
      
      // Remove the temporary fields
      delete updates.markSAComplete;
      delete updates.targetSA;
    }
    
    // Handle SA status toggle
    if (updates.toggleSAComplete && updates.targetSA) {
      const saCompletions = JSON.parse(currentAssignment.saCompletions || '{}');
      
      if (saCompletions[updates.targetSA]) {
        // Toggle from complete to in progress
        delete saCompletions[updates.targetSA];
      } else {
        // Toggle from in progress to complete
        saCompletions[updates.targetSA] = {
          completedAt: new Date().toISOString(),
          completedBy: updates.targetSA
        };
      }
      
      updates.saCompletions = JSON.stringify(saCompletions);
      
      // Check if all SAs are complete
      const allSAs = currentAssignment.saAssigned ? currentAssignment.saAssigned.split(',').map(s => s.trim()) : [];
      const completedSAs = Object.keys(saCompletions);
      const allComplete = allSAs.length > 0 && allSAs.every(sa => completedSAs.includes(sa));
      
      if (allComplete) {
        updates.status = 'Complete';
        updates.completedAt = new Date().toISOString();
        updates.completedBy = 'All SAs';
      } else if (currentAssignment.status === 'Complete') {
        // If assignment was complete but now an SA is incomplete, revert to Assigned
        updates.status = 'Assigned';
        updates.completedAt = '';
        updates.completedBy = '';
      }
      
      // Store status change for email notification
      const statusChanged = updates.status && updates.status !== currentAssignment.status;
      
      // Send Webex notification for status toggle
      if (currentAssignment.webex_space_id) {
        try {
          const assignedPractices = currentAssignment.practice ? currentAssignment.practice.split(',').map(p => p.trim()).sort() : [];
          if (assignedPractices.length > 0) {
            const primaryPractice = assignedPractices[0];
            const webexBot = await db.getPracticeWebexBot(primaryPractice);
            
            if (webexBot && webexBot.accessToken) {
              const { saWebexService } = await import('../../../../lib/sa-webex-service.js');
              await saWebexService.sendSACompletionUpdate(
                currentAssignment.webex_space_id,
                { ...currentAssignment, ...updates, saCompletions: updates.saCompletions },
                webexBot.accessToken,
                updates.targetSA
              );
            }
          }
        } catch (webexError) {
          console.error('Failed to send Webex status toggle update:', webexError);
        }
      }
      
      // Remove the temporary fields
      delete updates.toggleSAComplete;
      delete updates.targetSA;
      
      // Send completion email if assignment just became complete
      if (statusChanged && updates.status === 'Complete') {
        try {
          const updatedAssignment = { ...currentAssignment, ...updates };
          await saEmailService.sendSACompletionNotification(updatedAssignment);
        } catch (emailError) {
          console.error('Failed to send SA completion notification:', emailError);
        }
      }
    }
    
    // Add timestamps for status changes
    const timestamp = new Date().toISOString();
    if (newStatus && newStatus !== oldStatus) {
      if (newStatus === 'Unassigned') {
        updates.unassignedAt = timestamp;
      } else if (newStatus === 'Assigned') {
        updates.assignedAt = timestamp;
      } else if (newStatus === 'Complete') {
        updates.completedAt = timestamp;
        // Store who completed it if provided
        if (updates.completedBy) {
          updates.completedBy = updates.completedBy;
        }
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
          // Use cached assignment data with updates applied
          const updatedAssignment = { ...currentAssignment, ...updates };
          
          if (newStatus === 'Pending') {
            await saEmailService.sendPendingSAAssignmentNotification(updatedAssignment);
          } else if (newStatus === 'Unassigned' && updatedAssignment.practice && updatedAssignment.practice !== 'Pending') {
            await saEmailService.sendPracticeAssignedNotification(updatedAssignment);
          } else if (newStatus === 'Assigned' && updatedAssignment.saAssigned) {
            // Create Webex space first, then send email with space ID
            try {
              const spaceId = await saWebexService.createSASpace(updatedAssignment);
              if (spaceId) {
                // Get fresh assignment with space ID for email
                const finalAssignment = await db.getSaAssignmentById(params.id);
                await saEmailService.sendSAAssignedNotification(finalAssignment);
              } else {
                // Send email without space ID if creation failed
                await saEmailService.sendSAAssignedNotification(updatedAssignment);
              }
            } catch (webexError) {
              // Send email without space ID if Webex fails
              await saEmailService.sendSAAssignedNotification(updatedAssignment);
            }
          } else if (newStatus === 'Complete') {
            // Send completion notification
            try {
              await saEmailService.sendSACompletionNotification(updatedAssignment);
            } catch (emailError) {
              // Email notification failed but don't fail the request
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