import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';
import { validateUserSession } from '../../../../lib/auth-check';
import { etaTracker } from '../../../../lib/eta-tracker';
import { saEmailService } from '../../../../lib/sa-email-service';
import { saWebexService } from '../../../../lib/sa-webex-service';
import { getSecureParameter } from '../../../../lib/ssm-config';

// Calculate overall status based on individual SA statuses
function calculateOverallStatus(saAssigned, saCompletions, practiceAssignments) {
  const completions = saCompletions || {};
  
  // Get all assigned SAs from practiceAssignments
  let allAssignedSAs = [];
  if (practiceAssignments) {
    try {
      const assignments = typeof practiceAssignments === 'string' ? JSON.parse(practiceAssignments) : practiceAssignments;
      Object.entries(assignments).forEach(([practice, saList]) => {
        if (Array.isArray(saList)) {
          saList.forEach(sa => {
            allAssignedSAs.push(`${sa}::${practice}`);
          });
        }
      });
    } catch (e) {
      console.error('Error parsing practiceAssignments in calculateOverallStatus:', e);
    }
  }
  
  // Fallback to legacy saAssigned if no practiceAssignments
  if (allAssignedSAs.length === 0 && saAssigned) {
    allAssignedSAs = saAssigned.split(',').map(sa => sa.trim()).filter(sa => sa);
  }
  
  if (allAssignedSAs.length === 0) return 'Assigned';
  
  // Get statuses for all assigned SAs
  const allStatuses = [];
  allAssignedSAs.forEach(saKey => {
    const completion = completions[saKey] || completions[saKey.split('::')[0]];
    if (completion && completion.status) {
      allStatuses.push(completion.status);
    } else if (completion && completion.completedAt) {
      allStatuses.push('Complete');
    } else {
      allStatuses.push('In Progress');
    }
  });
  
  // Check if all statuses are complete
  if (allStatuses.every(s => s === 'Complete' || s === 'Approved/Complete')) {
    return 'Complete';
  }
  
  // Check if all statuses are pending approval
  if (allStatuses.every(s => s === 'Pending Approval')) {
    return 'Pending Approval';
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
  try {
    console.log('DEBUG: PUT request received for SA assignment', params.id);
    // Check for service authentication (for automated processes)
    const serviceAuth = request.headers.get('x-service-auth');
    const serviceSource = request.headers.get('x-service-source');
    let isAuthorized = false;
    let updates = null;
    
    // Get admin API key from environment or SSM (for local dev)
    let adminApiKey = process.env.ADMIN_API_KEY;
    if (!adminApiKey) {
      const env = process.env.ENVIRONMENT || 'dev';
      const ssmPrefix = env === 'prod' ? '/PracticeTools' : `/PracticeTools/${env}`;
      adminApiKey = await getSecureParameter(`${ssmPrefix}/ADMIN_API_KEY`);
    }
    
    if (serviceAuth && serviceAuth === adminApiKey && serviceSource === 'email-processor') {
      // Parse request body for service authentication
      updates = await request.json();
      console.log('DEBUG: Service auth - received updates:', JSON.stringify(updates, null, 2));
      
      // Validate allowed operations for email processor
      if (!updates.updateSAStatus && !updates.saCompletions) {
        return NextResponse.json({ error: 'Unauthorized operation for email processor' }, { status: 401 });
      }
      
      isAuthorized = true;
    } else {
      // Fall back to user session validation
      const userCookie = request.cookies.get('user-session');
      const validation = await validateUserSession(userCookie);
      if (validation.valid) {
        isAuthorized = true;
        updates = await request.json();
        console.log('DEBUG: User auth - received updates:', JSON.stringify(updates, null, 2));
      }
    }
    
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
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
      updates.status = calculateOverallStatus(currentAssignment.saAssigned, saCompletions, currentAssignment.practiceAssignments);
      
      if (updates.status === 'Complete') {
        updates.completedAt = new Date().toISOString();
        updates.completedBy = 'All SAs';
      }
      
      // Legacy Webex notification removed - handled by new individual SA status update system
      
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
      updates.status = calculateOverallStatus(currentAssignment.saAssigned, saCompletions, currentAssignment.practiceAssignments);
      
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
      
      // Legacy Webex notification removed - handled by new individual SA status update system
      
      // Remove the temporary fields
      delete updates.toggleSAComplete;
      delete updates.targetSA;
    }
    
    // Handle direct saCompletions update from email processor (SA Assignment Approved)
    if (updates.saCompletions && updates.updateSAStatus && serviceSource === 'email-processor') {
      // Direct saCompletions update - just update the overall status
      const saCompletions = JSON.parse(updates.saCompletions);
      updates.status = calculateOverallStatus(currentAssignment.saAssigned, saCompletions, currentAssignment.practiceAssignments);
      
      if (updates.status === 'Complete') {
        updates.completedAt = new Date().toISOString();
        updates.completedBy = 'All SAs';
      }
      
      console.log('DEBUG: Direct saCompletions update from email processor', {
        saAssignmentId: params.id,
        newStatus: updates.status,
        completionCount: Object.keys(saCompletions).length
      });
      
      // Remove updateSAStatus flag before DynamoDB update
      delete updates.updateSAStatus;
    }
    // Handle individual SA status update
    else if (updates.updateSAStatus && updates.targetSA && updates.saStatus) {
      console.log('DEBUG: Starting individual SA status update', {
        targetSA: updates.targetSA,
        saStatus: updates.saStatus,
        targetPractice: updates.targetPractice,
        hasRevisionNumber: !!updates.revisionNumber,
        revisionNumber: updates.revisionNumber,
        currentPracticeAssignments: currentAssignment.practiceAssignments,
        serviceSource: serviceSource
      });
      const saCompletions = JSON.parse(currentAssignment.saCompletions || '{}');
      let previousSAStatus = 'In Progress'; // Default value
      
      if (updates.saStatus === 'Complete') {
        // Preserve existing revision number if present
        const existingRevision = saCompletions[updates.targetSA]?.revisionNumber;
        saCompletions[updates.targetSA] = {
          completedAt: new Date().toISOString(),
          completedBy: updates.targetSA,
          status: 'Complete'
        };
        if (existingRevision) {
          saCompletions[updates.targetSA].revisionNumber = existingRevision;
        }
      } else {
        // Handle all other status updates (In Progress, Pending Approval, Approved/Complete, etc.)
        // Use specific practice if provided, otherwise find which practice this SA belongs to
        let targetPractice = updates.targetPractice || null;
        
        if (!targetPractice && currentAssignment.practiceAssignments) {
          try {
            const practiceAssignments = JSON.parse(currentAssignment.practiceAssignments);
            console.log('DEBUG: No target practice specified, searching for practice', {
              targetSA: updates.targetSA,
              practiceAssignments: practiceAssignments
            });
            
            for (const [practice, saList] of Object.entries(practiceAssignments)) {
              if (Array.isArray(saList) && saList.includes(updates.targetSA)) {
                targetPractice = practice;
                console.log('DEBUG: Found target practice', { targetPractice, saList });
                break;
              }
            }
            
            if (!targetPractice) {
              console.log('DEBUG: No practice found for SA, checking partial matches');
              // Try partial matching for cases where frontend sends friendly name but DB has "Name <email>" format
              for (const [practice, saList] of Object.entries(practiceAssignments)) {
                if (Array.isArray(saList)) {
                  const matchingSA = saList.find(sa => 
                    sa.toLowerCase().includes(updates.targetSA.toLowerCase()) ||
                    updates.targetSA.toLowerCase().includes(sa.toLowerCase())
                  );
                  if (matchingSA) {
                    targetPractice = practice;
                    console.log('DEBUG: Found target practice via partial match', { targetPractice, matchingSA });
                    break;
                  }
                }
              }
            }
          } catch (e) {
            console.error('Error parsing practiceAssignments for practice lookup', e);
          }
        } else if (targetPractice) {
          console.log('DEBUG: Using specified target practice', { targetPractice });
        }
        
        if (targetPractice) {
          const practiceAssignments = JSON.parse(currentAssignment.practiceAssignments);
          
          // Store previous status for comparison BEFORE modifying saCompletions
          const practiceSpecificKey = `${updates.targetSA}::${targetPractice}`;
          previousSAStatus = (() => {
            const completion = saCompletions[practiceSpecificKey] || saCompletions[updates.targetSA];
            if (completion?.status === 'Pending Approval') return 'Pending Approval';
            if (completion?.status === 'Approved' || completion?.status === 'Complete' || completion?.completedAt) return 'Approved/Complete';
            return 'In Progress';
          })();
          
          console.log('DEBUG: Previous SA status calculation', {
            targetSA: updates.targetSA,
            targetPractice,
            practiceSpecificKey,
            previousSAStatus,
            newSAStatus: updates.saStatus,
            currentSaCompletions: saCompletions
          });
          
          // Update only the specific SA for the specific practice
          if (updates.saStatus === 'In Progress') {
            delete saCompletions[practiceSpecificKey];
          } else {
            saCompletions[practiceSpecificKey] = {
              status: updates.saStatus,
              updatedAt: new Date().toISOString()
            };
            if (updates.revisionNumber) {
              saCompletions[practiceSpecificKey].revisionNumber = updates.revisionNumber;
            }
            if (updates.saStatus === 'Approved/Complete') {
              saCompletions[practiceSpecificKey].completedAt = new Date().toISOString();
              saCompletions[practiceSpecificKey].completedBy = updates.targetSA;
            }
          }
          
          console.log('DEBUG: Applied status to specific SA in practice', {
            targetPractice,
            targetSA: updates.targetSA,
            status: updates.saStatus,
            practiceSpecificKey
          });
        } else {
          // Fallback: legacy single SA update
          // Store previous status for comparison BEFORE modifying saCompletions
          previousSAStatus = (() => {
            const completion = saCompletions[updates.targetSA];
            if (completion?.status === 'Pending Approval') return 'Pending Approval';
            if (completion?.status === 'Approved' || completion?.status === 'Complete' || completion?.completedAt) return 'Approved/Complete';
            return 'In Progress';
          })();
          
          if (updates.saStatus === 'In Progress') {
            // Remove completion entry for In Progress status
            delete saCompletions[updates.targetSA];
          } else {
            saCompletions[updates.targetSA] = {
              status: updates.saStatus,
              updatedAt: new Date().toISOString()
            };
            if (updates.revisionNumber) {
              saCompletions[updates.targetSA].revisionNumber = updates.revisionNumber;
            }
            if (updates.saStatus === 'Approved/Complete') {
              saCompletions[updates.targetSA].completedAt = new Date().toISOString();
              saCompletions[updates.targetSA].completedBy = updates.targetSA;
            }
          }
          console.log('DEBUG: Applied status to single SA (no practice found)', updates.targetSA);
        }
      }
      
      console.log('DEBUG: saCompletions before stringify', {
        targetSA: updates.targetSA,
        saCompletions: saCompletions,
        targetSACompletion: saCompletions[updates.targetSA]
      });
      updates.saCompletions = JSON.stringify(saCompletions);
      console.log('DEBUG: stringified saCompletions', updates.saCompletions);
      
      // Update overall status based on individual SA statuses
      updates.status = calculateOverallStatus(currentAssignment.saAssigned, saCompletions, currentAssignment.practiceAssignments);
      
      if (updates.status === 'Complete') {
        updates.completedAt = new Date().toISOString();
        updates.completedBy = 'All SAs';
      } else if (currentAssignment.status === 'Complete' && updates.status !== 'Complete') {
        updates.completedAt = '';
        updates.completedBy = '';
      }
      

      

      
      // Send batched status change notification for manual updates (when multiple SAs affected)
      console.log('DEBUG: Checking Webex notification conditions', {
        hasWebexSpaceId: !!currentAssignment.webex_space_id,
        webexSpaceId: currentAssignment.webex_space_id,
        statusChanged: updates.saStatus !== previousSAStatus,
        previousSAStatus,
        newSAStatus: updates.saStatus,
        isNotEmailProcessor: serviceSource !== 'email-processor',
        serviceSource
      });
      
      if (currentAssignment.webex_space_id && updates.saStatus !== previousSAStatus && serviceSource !== 'email-processor') {
        console.log('DEBUG: Webex notification conditions met, proceeding...');
        try {
          const assignedPractices = currentAssignment.practice ? currentAssignment.practice.split(',').map(p => p.trim()).sort() : [];
          console.log('DEBUG: Assigned practices', assignedPractices);
          
          if (assignedPractices.length > 0) {
            const primaryPractice = assignedPractices[0];
            console.log('DEBUG: Primary practice', primaryPractice);
            
            const webexBot = await db.getPracticeWebexBot(primaryPractice);
            console.log('DEBUG: Webex bot retrieved', {
              hasBot: !!webexBot,
              hasAccessToken: !!(webexBot && webexBot.accessToken),
              botEmail: webexBot?.email
            });
            
            if (webexBot && webexBot.accessToken) {
              // Use the target practice from the update request
              const notificationPractice = updates.targetPractice;
              
              console.log('DEBUG: Using target practice for notification', { notificationPractice });
              
              const { saWebexService } = await import('../../../../lib/sa-webex-service.js');
              
              // Always send individual notification for single SA updates
              console.log('DEBUG: Sending individual notification for single SA');
              const saName = updates.targetSA.replace(/<[^>]+>/g, '').trim();
              await saWebexService.sendStatusChangeNotification(
                currentAssignment.webex_space_id,
                currentAssignment,
                webexBot.accessToken,
                saName,
                previousSAStatus,
                updates.saStatus,
                false,
                notificationPractice
              );
              console.log('DEBUG: Individual notification sent successfully');
            } else {
              console.log('DEBUG: No Webex bot or access token available');
            }
          } else {
            console.log('DEBUG: No assigned practices found');
          }
        } catch (webexError) {
          console.error('Failed to send Webex status change notification:', webexError);
        }
      } else {
        console.log('DEBUG: Webex notification conditions not met, skipping notification');
      }
      
      // Store status change for email notification
      const statusChanged = updates.status && updates.status !== currentAssignment.status;
      
      // Remove the temporary fields
      delete updates.updateSAStatus;
      delete updates.targetSA;
      delete updates.saStatus;
      delete updates.revisionNumber;
      delete updates.targetPractice;
      
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
    
    // DSR: Handle practiceAssignments updates and clean up saCompletions
    if (updates.practiceAssignments) {
      try {
        const newPracticeAssignments = JSON.parse(updates.practiceAssignments);
        const oldPracticeAssignments = currentAssignment.practiceAssignments ? JSON.parse(currentAssignment.practiceAssignments) : {};
        const saCompletions = JSON.parse(currentAssignment.saCompletions || '{}');
        
        // Find removed practices and clean up their SA completion entries
        const removedPractices = Object.keys(oldPracticeAssignments).filter(practice => 
          !newPracticeAssignments.hasOwnProperty(practice)
        );
        
        if (removedPractices.length > 0) {
          // Remove practice-specific completion entries for removed practices
          Object.keys(saCompletions).forEach(key => {
            if (key.includes('::')) {
              const practice = key.split('::')[1];
              if (removedPractices.includes(practice)) {
                delete saCompletions[key];
              }
            }
          });
          
          // Update saCompletions in the updates object
          updates.saCompletions = JSON.stringify(saCompletions);
          
          console.log('DEBUG: Cleaned up SA completions for removed practices:', removedPractices);
        }
      } catch (e) {
        console.error('Error processing practiceAssignments update:', e);
      }
    }
    
    // Add timestamps for status changes
    const timestamp = new Date().toISOString();
    if (newStatus && newStatus !== oldStatus) {
      if (newStatus === 'Unassigned') {
        updates.unassignedAt = timestamp;
      } else if (newStatus === 'Assigned') {
        updates.assignedAt = timestamp;
      } else if (newStatus === 'Pending Approval') {
        updates.pendingApprovalAt = timestamp;
      } else if (newStatus === 'Complete' || newStatus === 'Approved') {
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
              
              if (newStatus === 'Complete') {
                // Send special completion notification
                const updatedAssignment = { ...currentAssignment, ...updates };
                await saWebexService.sendSAAssignmentCompletionNotification(
                  currentAssignment.webex_space_id,
                  updatedAssignment,
                  webexBot.accessToken
                );
              } else {
                // Send regular status change notification
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