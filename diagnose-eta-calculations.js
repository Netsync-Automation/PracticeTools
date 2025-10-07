#!/usr/bin/env node

import { db } from './lib/dynamodb.js';

async function diagnoseETACalculations() {
  console.log('🔍 Diagnosing ETA Calculations...\n');

  try {
    // 1. Check if Practice ETAs table exists and has data
    console.log('1. Checking Practice ETAs table...');
    const practiceETAs = await db.getAllSettings();
    const etaSettings = practiceETAs.filter(setting => 
      setting.setting_key.includes('practice_eta') || 
      setting.setting_key.includes('resource_eta')
    );
    
    console.log(`   Found ${etaSettings.length} ETA-related settings:`);
    etaSettings.forEach(setting => {
      console.log(`   - ${setting.setting_key}: ${setting.setting_value}`);
    });

    // 2. Check Assignment Status Log for status changes
    console.log('\n2. Checking Assignment Status Log...');
    const assignments = await db.getAllAssignments();
    console.log(`   Total assignments: ${assignments.length}`);
    
    const statusChanges = {
      'Pending->Unassigned': 0,
      'Unassigned->Assigned': 0
    };

    for (const assignment of assignments.slice(0, 10)) { // Check first 10
      try {
        const history = await db.getAssignmentStatusHistory(assignment.id);
        console.log(`   Assignment ${assignment.assignment_number}: ${history.length} status changes`);
        
        history.forEach(change => {
          const transition = `${change.from_status}->${change.to_status}`;
          if (statusChanges[transition] !== undefined) {
            statusChanges[transition]++;
          }
          console.log(`     ${change.changed_at}: ${transition}`);
        });
      } catch (error) {
        console.log(`     Error getting history for ${assignment.id}: ${error.message}`);
      }
    }

    console.log('\n   Status change summary:');
    Object.entries(statusChanges).forEach(([transition, count]) => {
      console.log(`   - ${transition}: ${count} changes`);
    });

    // 3. Check specific practice ETAs
    console.log('\n3. Checking specific practice ETAs...');
    const practices = ['Project Management', 'Audio Visual', 'Enterprise Networking', 'Data Center', 'Cyber Security', 'WAN Optical'];
    
    for (const practice of practices) {
      try {
        const eta = await db.getPracticeETA(practice);
        if (eta) {
          console.log(`   ${practice}:`);
          console.log(`     Practice Assignment ETA: ${eta.practice_assignment_eta_hours || 'N/A'} hours (${eta.practice_assignment_sample_size || 0} samples)`);
          console.log(`     Resource Assignment ETA: ${eta.resource_assignment_eta_hours || 'N/A'} hours (${eta.resource_assignment_sample_size || 0} samples)`);
        } else {
          console.log(`   ${practice}: No ETA data found`);
        }
      } catch (error) {
        console.log(`   ${practice}: Error - ${error.message}`);
      }
    }

    // 4. Check if status log table exists
    console.log('\n4. Checking Assignment Status Log table...');
    try {
      const sampleHistory = await db.getAssignmentStatusHistory('test-id');
      console.log('   ✅ Assignment Status Log table exists');
    } catch (error) {
      if (error.message.includes('ResourceNotFoundException')) {
        console.log('   ❌ Assignment Status Log table does NOT exist');
        console.log('   This explains why ETAs are N/A - no status change data is being logged');
      } else {
        console.log(`   ⚠️  Error accessing table: ${error.message}`);
      }
    }

    // 5. Test ETA calculation logic
    console.log('\n5. Testing ETA calculation for a practice...');
    try {
      await db.updatePracticeAssignmentETA('Project Management');
      console.log('   ✅ Practice assignment ETA calculation completed');
    } catch (error) {
      console.log(`   ❌ Practice assignment ETA calculation failed: ${error.message}`);
    }

    try {
      await db.updateResourceAssignmentETA('Project Management');
      console.log('   ✅ Resource assignment ETA calculation completed');
    } catch (error) {
      console.log(`   ❌ Resource assignment ETA calculation failed: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Diagnosis failed:', error);
  }
}

// Run diagnosis
diagnoseETACalculations().then(() => {
  console.log('\n🔍 Diagnosis complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Diagnosis error:', error);
  process.exit(1);
});