/**
 * Backfill assignment timestamps for existing assignments
 * This script adds unassignedAt and assignedAt timestamps to existing assignments
 * based on their current status and creation date
 */

import { db } from '../lib/dynamodb.js';

async function backfillAssignmentTimestamps() {
  try {
    console.log('Starting assignment timestamp backfill...');
    
    const assignments = await db.getAllAssignments();
    console.log(`Found ${assignments.length} assignments to process`);
    
    let updatedCount = 0;
    
    for (const assignment of assignments) {
      const updates = {};
      let needsUpdate = false;
      
      // If assignment is Unassigned and doesn't have unassignedAt timestamp
      if (assignment.status === 'Unassigned' && !assignment.unassignedAt) {
        // Use created_at as fallback for unassignedAt
        updates.unassignedAt = assignment.created_at;
        needsUpdate = true;
        console.log(`Setting unassignedAt for assignment #${assignment.assignment_number}`);
      }
      
      // If assignment is Assigned and doesn't have assignedAt timestamp
      if (assignment.status === 'Assigned' && !assignment.assignedAt) {
        // Use dateAssigned if available, otherwise created_at
        updates.assignedAt = assignment.dateAssigned || assignment.created_at;
        needsUpdate = true;
        console.log(`Setting assignedAt for assignment #${assignment.assignment_number}`);
        
        // Also set unassignedAt if not present (assume it was unassigned at creation)
        if (!assignment.unassignedAt) {
          updates.unassignedAt = assignment.created_at;
          console.log(`Setting unassignedAt for assignment #${assignment.assignment_number}`);
        }
      }
      
      if (needsUpdate) {
        const success = await db.updateAssignment(assignment.id, updates);
        if (success) {
          updatedCount++;
          console.log(`✅ Updated assignment #${assignment.assignment_number}`);
        } else {
          console.log(`❌ Failed to update assignment #${assignment.assignment_number}`);
        }
      }
    }
    
    console.log(`\nBackfill complete! Updated ${updatedCount} assignments.`);
    
  } catch (error) {
    console.error('Error during backfill:', error);
  }
}

// Run the backfill
backfillAssignmentTimestamps();