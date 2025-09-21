import { db } from './lib/dynamodb.js';

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

async function fixSAAssignment() {
  try {
    const saAssignmentId = '55f559a0-0bfc-44fd-80a2-d4580e274804';
    
    // Get current assignment
    const assignment = await db.getSaAssignmentById(saAssignmentId);
    if (!assignment) {
      console.log('SA assignment not found');
      return;
    }
    
    console.log('Current status:', assignment.status);
    console.log('SA Completions:', assignment.saCompletions);
    console.log('Practice Assignments:', assignment.practiceAssignments);
    
    // Parse completions
    const saCompletions = JSON.parse(assignment.saCompletions || '{}');
    
    // Calculate new status
    const newStatus = calculateOverallStatus(assignment.saAssigned, saCompletions, assignment.practiceAssignments);
    
    console.log('Calculated new status:', newStatus);
    
    if (newStatus !== assignment.status) {
      const updates = {
        status: newStatus
      };
      
      if (newStatus === 'Complete') {
        updates.completedAt = new Date().toISOString();
        updates.completedBy = 'All SAs';
      }
      
      const success = await db.updateSaAssignment(saAssignmentId, updates);
      
      if (success) {
        console.log('Successfully updated SA assignment status to:', newStatus);
      } else {
        console.log('Failed to update SA assignment');
      }
    } else {
      console.log('Status is already correct');
    }
    
  } catch (error) {
    console.error('Error fixing SA assignment:', error);
  }
}

fixSAAssignment();