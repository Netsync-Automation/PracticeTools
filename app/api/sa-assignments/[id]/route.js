import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';
import { validateUserSession } from '../../../../lib/auth-check';
import { etaTracker } from '../../../../lib/eta-tracker';
import { saEmailService } from '../../../../lib/sa-email-service';
import { saWebexService } from '../../../../lib/sa-webex-service';
import { getSecureParameter } from '../../../../lib/ssm-config';

// Calculate overall status based on individual SA statuses
function calculateOverallStatus(saAssigned, saCompletions) {
  if (!saAssigned || !saAssigned.trim()) return 'Assigned';
  
  const allSAs = saAssigned.split(',').map(s => s.trim());
  const completions = saCompletions || {};
  
  // Check for individual SA statuses - prioritize Pending Approval
  const hasPendingApproval = Object.values(completions).some(completion => 
    completion && completion.status === 'Pending Approval'
  );
  
  if (hasPendingApproval) {
    return 'Pending Approval';
  }
  
  // Check for Approved status
  const hasApproved = Object.values(completions).some(completion => 
    completion && completion.status === 'Approved'
  );
  
  const allApprovedOrComplete = allSAs.every(sa => {
    const completion = completions[sa];
    return completion && (completion.status === 'Approved' || completion.status === 'Complete' || completion.completedAt);
  });
  
  if (hasApproved && allApprovedOrComplete) {
    return 'Approved';
  }
  
  // Check if all SAs are complete
  const completedSAs = Object.keys(completions).filter(sa => 
    completions[sa] && (completions[sa].completedAt || completions[sa].status === 'Complete')
  );
  
  if (allSAs.length > 0 && allSAs.every(sa => completedSAs.includes(sa))) {
    return 'Complete';
  }
  
  return 'Assigned';
}


export const dynamic = 'force-dynamic';
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
  console.log('[API-ROUTE] PUT request received for SA assignment:', params.id);
  
  try {
    // Check for service authentication (for automated processes)
    const serviceAuth = request.headers.get('x-service-auth');
    const serviceSource = request.headers.get('x-service-source');
    let isAuthorized = false;
    let updates = null;
    
    console.log('[API-ROUTE] Headers received:', {
      hasServiceAuth: !!serviceAuth,
      serviceSource,
      allHeaders: Object.fromEntries(request.headers.entries())
    });
    
    // Get admin API key from environment or SSM (for local dev)
    let adminApiKey = process.env.ADMIN_API_KEY;
    if (!adminApiKey) {
      const env = process.env.ENVIRONMENT || 'dev';
      const ssmPrefix = env === 'prod' ? '/PracticeTools' : `/PracticeTools/${env}`;
      adminApiKey = await getSecureParameter(`${ssmPrefix}/ADMIN_API_KEY`);
    }
    
    console.log('[API-AUTH] Service authentication check:', {
      hasServiceAuth: !!serviceAuth,
      serviceAuthLength: serviceAuth?.length,
      serviceAuthFirst10: serviceAuth?.substring(0, 10),
      serviceSource,
      hasAdminApiKey: !!adminApiKey,
      adminApiKeyLength: adminApiKey?.length,
      adminApiKeyFirst10: adminApiKey?.substring(0, 10),
      serviceAuthMatch: serviceAuth === adminApiKey,
      sourceMatch: serviceSource === 'email-processor'
    });
    
    if (serviceAuth && serviceAuth === adminApiKey && serviceSource === 'email-processor') {
      console.log('[API-AUTH] Service authentication successful');
      // Parse request body for service authentication
      updates = await request.json();
      
      // Validate allowed operations for email processor
      if (!updates.updateSAStatus) {
        console.log('[API-AUTH] Unauthorized operation for email processor:', updates);
        return NextResponse.json({ error: 'Unauthorized operation for email processor' }, { status: 401 });
      }
      
      isAuthorized = true;
    } else {
      console.log('[API-AUTH] Service auth failed, trying user session');
      // Fall back to user session validation
      const userCookie = request.cookies.get('user-session');
      const validation = await validateUserSession(userCookie);
      if (validation.valid) {
        console.log('[API-AUTH] User session authentication successful');
        isAuthorized = true;
        updates = await request.json();
      } else {
        console.log('[API-AUTH] User session authentication failed');
      }
    }
    
    if (!isAuthorized) {
      console.log('[API-AUTH] Final authorization failed');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('[API-AUTH] Authorization successful, proceeding with updates:', updates);
    
    if (!updates) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    
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
      
      // Update overall status based on individual SA statuses
      updates.status = calculateOverallStatus(currentAssignment.saAssigned, saCompletions);
      
      if (updates.status === 'Complete') {
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
      
      // Update overall status based on individual SA statuses
      updates.status = calculateOverallStatus(currentAssignment.saAssigned, saCompletions);
      
      if (updates.status === 'Complete') {
        updates.completedAt = new Date().toISOString();
        updates.completedBy = 'All SAs';
      } else if (currentAssignment.status === 'Complete' && updates.status !== 'Complete') {
        // If assignment was complete but now not all SAs are complete, clear completion fields
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
    }
    
    // Handle individual SA status update
    if (updates.updateSAStatus && updates.targetSA && updates.saStatus) {
      const saCompletions = JSON.parse(currentAssignment.saCompletions || '{}');
      
      if (updates.saStatus === 'Complete') {
        saCompletions[updates.targetSA] = {
          completedAt: new Date().toISOString(),
          completedBy: updates.targetSA,
          status: 'Complete'
        };
      } else if (updates.saStatus === 'Pending Approval') {
        saCompletions[updates.targetSA] = {
          status: 'Pending Approval',
          updatedAt: new Date().toISOString()
        };
      } else if (updates.saStatus === 'Approved/Complete') {
        saCompletions[updates.targetSA] = {
          status: 'Approved/Complete',
          completedAt: new Date().toISOString(),
          completedBy: updates.targetSA
        };
      } else {
        // For other statuses or to clear status
        if (saCompletions[updates.targetSA]) {
          delete saCompletions[updates.targetSA];
        }
      }
      
      updates.saCompletions = JSON.stringify(saCompletions);
      
      // Update overall status based on individual SA statuses
      updates.status = calculateOverallStatus(currentAssignment.saAssigned, saCompletions);
      
      if (updates.status === 'Complete') {
        updates.completedAt = new Date().toISOString();
        updates.completedBy = 'All SAs';
      } else if (currentAssignment.status === 'Complete' && updates.status !== 'Complete') {
        updates.completedAt = '';
        updates.completedBy = '';
      }
      
      // Send Webex notification for SA status update
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
          console.error('Failed to send Webex status update:', webexError);
        }
      }
      
      // Store previous status for comparison
      const previousSAStatus = (() => {
        const saCompletions = JSON.parse(currentAssignment.saCompletions || '{}');
        const completion = saCompletions[updates.targetSA];
        if (completion?.status === 'Pending Approval') return 'Pending Approval';
        if (completion?.status === 'Approved' || completion?.status === 'Complete' || completion?.completedAt) return 'Approved/Complete';
        return 'In Progress';
      })();
      
      // Send status change notification to Webex
      if (currentAssignment.webex_space_id && updates.saStatus !== previousSAStatus) {
        try {
          const assignedPractices = currentAssignment.practice ? currentAssignment.practice.split(',').map(p => p.trim()).sort() : [];
          if (assignedPractices.length > 0) {
            const primaryPractice = assignedPractices[0];
            const webexBot = await db.getPracticeWebexBot(primaryPractice);
            
            if (webexBot && webexBot.accessToken) {
              const { saWebexService } = await import('../../../../lib/sa-webex-service.js');
              const saName = updates.targetSA.replace(/<[^>]+>/g, '').trim();
              await saWebexService.sendStatusChangeNotification(
                currentAssignment.webex_space_id,
                currentAssignment,
                webexBot.accessToken,
                saName,
                previousSAStatus,
                updates.saStatus,
                false
              );
            }
          }
        } catch (webexError) {
          console.error('Failed to send Webex status change notification:', webexError);
        }
      }
      
      // Store status change for email notification
      const statusChanged = updates.status && updates.status !== currentAssignment.status;
      
      // Remove the temporary fields
      delete updates.updateSAStatus;
      delete updates.targetSA;
      delete updates.saStatus;
      
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
      
      // Send Webex notification for overall status changes
      if (newStatus && newStatus !== oldStatus && currentAssignment.webex_space_id) {
        try {
          const assignedPractices = currentAssignment.practice ? currentAssignment.practice.split(',').map(p => p.trim()).sort() : [];
          if (assignedPractices.length > 0) {
            const primaryPractice = assignedPractices[0];
            const webexBot = await db.getPracticeWebexBot(primaryPractice);
            
            if (webexBot && webexBot.accessToken) {
              const { saWebexService } = await import('../../../../lib/sa-webex-service.js');
              await saWebexService.sendStatusChangeNotification(
                currentAssignment.webex_space_id,
                currentAssignment,
                webexBot.accessToken,
                'System',
                oldStatus,
                newStatus,
                true
              );
            }
          }
        } catch (webexError) {
          console.error('Failed to send Webex overall status change notification:', webexError);
        }
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