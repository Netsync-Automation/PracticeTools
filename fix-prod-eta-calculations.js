// Force production environment BEFORE any imports
process.env.ENVIRONMENT = 'prod';

import { db } from './lib/dynamodb.js';

async function fixProdETACalculations() {
  try {
    console.log('🔧 Fixing Production ETA Calculations...');
    console.log('Environment:', process.env.ENVIRONMENT);
    
    // 1. Get all assignments from production
    console.log('\n1. Analyzing existing assignments for ETA calculation...');
    const assignments = await db.getAllAssignments();
    console.log(`   Found ${assignments.length} total assignments`);
    
    // 2. Group assignments by practice and calculate ETAs
    console.log('\n2. Calculating and saving ETAs...');
    
    const practiceGroups = {};
    
    // Group assignments by practice
    assignments.forEach(assignment => {
      if (!assignment.practice || assignment.practice === 'Pending') return;
      
      const practices = assignment.practice.split(',').map(p => p.trim());
      practices.forEach(practice => {
        if (!practiceGroups[practice]) {
          practiceGroups[practice] = {
            practiceAssignments: [],
            resourceAssignments: []
          };
        }
        
        // Track practice assignments (Pending -> Unassigned)
        if (assignment.status !== 'Pending') {
          const createdDate = new Date(assignment.created_at);
          const assignedDate = new Date(assignment.updated_at);
          const hours = Math.ceil((assignedDate - createdDate) / (1000 * 60 * 60));
          
          if (hours > 0 && hours < 8760) { // Less than 1 year
            practiceGroups[practice].practiceAssignments.push(hours);
          }
        }
        
        // Track resource assignments (Unassigned -> Assigned)
        if (assignment.status === 'Assigned' && assignment.dateAssigned) {
          const assignedDate = new Date(assignment.dateAssigned);
          const createdDate = new Date(assignment.created_at);
          const hours = Math.ceil((assignedDate - createdDate) / (1000 * 60 * 60));
          
          if (hours > 0 && hours < 8760) { // Less than 1 year
            practiceGroups[practice].resourceAssignments.push(hours);
          }
        }
      });
    });
    
    // Calculate and save ETAs for each practice
    for (const [practice, data] of Object.entries(practiceGroups)) {
      console.log(`\n   Processing ${practice}:`);
      
      let practiceETA = 0, resourceETA = 0;
      
      if (data.practiceAssignments.length > 0) {
        practiceETA = Math.round(data.practiceAssignments.reduce((sum, hours) => sum + hours, 0) / data.practiceAssignments.length);
        console.log(`     Practice Assignment ETA: ${practiceETA} hours (${data.practiceAssignments.length} samples)`);
      } else {
        console.log(`     ⚠️  No practice assignment data for ${practice}`);
      }
      
      if (data.resourceAssignments.length > 0) {
        resourceETA = Math.round(data.resourceAssignments.reduce((sum, hours) => sum + hours, 0) / data.resourceAssignments.length);
        console.log(`     Resource Assignment ETA: ${resourceETA} hours (${data.resourceAssignments.length} samples)`);
      } else {
        console.log(`     ⚠️  No resource assignment data for ${practice}`);
      }
      
      if (practiceETA > 0 || resourceETA > 0) {
        // Save to database
        await db.savePracticeAssignmentETA(practice, practiceETA || 1, data.practiceAssignments.length || 1);
        await db.saveResourceAssignmentETA(practice, resourceETA || 1, data.resourceAssignments.length || 1);
        console.log(`     ✅ Saved ETAs for ${practice}`);
      }
    }
    
    // 3. Verify saved ETAs
    console.log('\n3. Verifying saved ETAs...');
    for (const practice of Object.keys(practiceGroups)) {
      const eta = await db.getPracticeETA(practice);
      if (eta) {
        console.log(`   ${practice}:`);
        if (eta.practice_assignment_eta_hours > 0) {
          console.log(`     Practice Assignment: ${eta.practice_assignment_eta_hours} hours`);
        }
        if (eta.resource_assignment_eta_hours > 0) {
          console.log(`     Resource Assignment: ${eta.resource_assignment_eta_hours} hours`);
        }
      } else {
        console.log(`   ${practice}: No ETA data found after save`);
      }
    }
    
    console.log('\n🔧 Production ETA calculations fixed');
    
  } catch (error) {
    console.error('❌ Error fixing production ETA calculations:', error);
    process.exit(1);
  }
}

fixProdETACalculations();