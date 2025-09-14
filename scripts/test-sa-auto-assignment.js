import { saAutoAssignment } from '../lib/sa-auto-assignment.js';
import { db } from '../lib/dynamodb.js';
import { logger } from '../lib/safe-logger.js';

/**
 * Test script for SA auto-assignment functionality
 * This script tests the auto-assignment utility with sample data
 */

async function testSaAutoAssignment() {
  try {
    console.log('🧪 Starting SA Auto-Assignment Test');
    console.log('=====================================');
    
    // Test 1: Get all SA assignments
    console.log('\n📋 Test 1: Fetching SA assignments...');
    const saAssignments = await db.getAllSaAssignments();
    console.log(`Found ${saAssignments.length} SA assignments`);
    
    if (saAssignments.length === 0) {
      console.log('❌ No SA assignments found. Please create some test data first.');
      return;
    }
    
    // Find an SA assignment with AM and Practice for testing
    const testAssignment = saAssignments.find(assignment => 
      assignment.am && assignment.practice && assignment.status !== 'Assigned'
    );
    
    if (!testAssignment) {
      console.log('❌ No suitable SA assignment found for testing (need AM and Practice, not Assigned)');
      console.log('Available assignments:');
      saAssignments.slice(0, 5).forEach(assignment => {
        console.log(`  - ID: ${assignment.id}, AM: ${assignment.am || 'None'}, Practice: ${assignment.practice || 'None'}, Status: ${assignment.status}`);
      });
      return;
    }
    
    console.log(`\n🎯 Test 2: Testing auto-assignment for SA Assignment #${testAssignment.sa_assignment_number}`);
    console.log(`  - AM: ${testAssignment.am}`);
    console.log(`  - Practice: ${testAssignment.practice}`);
    console.log(`  - Current Status: ${testAssignment.status}`);
    console.log(`  - Current SA Assigned: ${testAssignment.saAssigned || 'None'}`);
    console.log(`  - Current Region: ${testAssignment.region || 'None'}`);
    
    // Test the auto-assignment
    const result = await saAutoAssignment.processAutoAssignment(testAssignment.id);
    
    console.log('\n📊 Auto-Assignment Result:');
    console.log(`  - Success: ${result.success}`);
    console.log(`  - Message: ${result.message}`);
    console.log(`  - Assigned SAs: ${JSON.stringify(result.assignedSas)}`);
    console.log(`  - Region: ${result.region}`);
    
    if (result.success) {
      // Verify the assignment was updated
      console.log('\n✅ Test 3: Verifying assignment update...');
      const updatedAssignment = await db.getSaAssignmentById(testAssignment.id);
      
      if (updatedAssignment) {
        console.log(`  - Updated Status: ${updatedAssignment.status}`);
        console.log(`  - Updated SA Assigned: ${updatedAssignment.saAssigned}`);
        console.log(`  - Updated Region: ${updatedAssignment.region}`);
        console.log(`  - Updated Date Assigned: ${updatedAssignment.dateAssigned}`);
        
        if (updatedAssignment.status === 'Assigned' && updatedAssignment.saAssigned) {
          console.log('✅ Auto-assignment test PASSED!');
        } else {
          console.log('❌ Auto-assignment test FAILED - assignment not properly updated');
        }
      } else {
        console.log('❌ Could not retrieve updated assignment');
      }
    } else {
      console.log('ℹ️  Auto-assignment was not performed (this may be expected)');
    }
    
    // Test 4: Test with invalid assignment ID
    console.log('\n🧪 Test 4: Testing with invalid assignment ID...');
    const invalidResult = await saAutoAssignment.processAutoAssignment('invalid-id');
    console.log(`  - Success: ${invalidResult.success}`);
    console.log(`  - Message: ${invalidResult.message}`);
    
    if (!invalidResult.success && invalidResult.message.includes('not found')) {
      console.log('✅ Invalid ID test PASSED!');
    } else {
      console.log('❌ Invalid ID test FAILED');
    }
    
    console.log('\n🎉 SA Auto-Assignment Test Complete!');
    console.log('=====================================');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testSaAutoAssignment();