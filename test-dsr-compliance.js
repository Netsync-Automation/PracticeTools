#!/usr/bin/env node

/**
 * DSR Compliance Test for Resource Assignments
 * 
 * This test verifies that resource assignments now store both names and emails
 * for all user fields (Account Manager, Project Manager, Resource Assigned, and notification recipients)
 * to ensure DSR compliance for Webex notifications and email generation.
 */

import { db } from './lib/dynamodb.js';

async function testDSRCompliance() {
  console.log('🧪 Testing DSR Compliance for Resource Assignments...\n');

  try {
    // Test data
    const testAssignment = {
      practice: 'Test Practice',
      status: 'Pending',
      projectNumber: 'TEST-001',
      requestDate: new Date().toISOString().split('T')[0],
      eta: '',
      customerName: 'Test Customer',
      projectDescription: 'Test project for DSR compliance verification',
      region: 'Test Region',
      am: 'Test Account Manager',
      pm: 'Test Project Manager',
      resourceAssigned: 'Test Resource',
      dateAssigned: new Date().toISOString().split('T')[0],
      notes: 'DSR compliance test assignment',
      documentationLink: '',
      pmEmail: 'pm@test.com',
      attachments: [],
      notificationUsers: [
        { name: 'Test Notification User', email: 'notification@test.com' }
      ]
    };

    console.log('📝 Creating test assignment...');
    
    // Create assignment
    const assignmentId = await db.addAssignment(
      testAssignment.practice,
      testAssignment.status,
      testAssignment.projectNumber,
      testAssignment.requestDate,
      testAssignment.eta,
      testAssignment.customerName,
      testAssignment.projectDescription,
      testAssignment.region,
      testAssignment.am,
      testAssignment.pm,
      testAssignment.resourceAssigned,
      testAssignment.dateAssigned,
      testAssignment.notes,
      testAssignment.documentationLink,
      testAssignment.pmEmail,
      testAssignment.attachments,
      testAssignment.notificationUsers
    );

    if (!assignmentId) {
      console.error('❌ Failed to create test assignment');
      return false;
    }

    console.log(`✅ Test assignment created with ID: ${assignmentId}`);

    // Retrieve and verify the assignment
    console.log('🔍 Retrieving assignment to verify DSR compliance...');
    const retrievedAssignment = await db.getAssignmentById(assignmentId);

    if (!retrievedAssignment) {
      console.error('❌ Failed to retrieve test assignment');
      return false;
    }

    console.log('📊 Verifying DSR compliance fields...\n');

    // Check that all required fields are present
    const requiredFields = [
      { field: 'am', value: retrievedAssignment.am, description: 'Account Manager Name' },
      { field: 'am_email', value: retrievedAssignment.am_email, description: 'Account Manager Email' },
      { field: 'pm', value: retrievedAssignment.pm, description: 'Project Manager Name' },
      { field: 'pm_email', value: retrievedAssignment.pm_email, description: 'Project Manager Email' },
      { field: 'resourceAssigned', value: retrievedAssignment.resourceAssigned, description: 'Resource Assigned Name' },
      { field: 'resource_assigned_email', value: retrievedAssignment.resource_assigned_email, description: 'Resource Assigned Email' },
      { field: 'resource_assignment_notification_users', value: retrievedAssignment.resource_assignment_notification_users, description: 'Notification Users' }
    ];

    let complianceScore = 0;
    let totalChecks = 0;

    for (const check of requiredFields) {
      totalChecks++;
      const hasValue = check.value !== undefined && check.value !== null;
      const status = hasValue ? '✅' : '❌';
      const displayValue = hasValue ? (check.value.length > 50 ? check.value.substring(0, 50) + '...' : check.value) : 'MISSING';
      
      console.log(`${status} ${check.description}: ${displayValue}`);
      
      if (hasValue) {
        complianceScore++;
      }
    }

    console.log(`\n📈 DSR Compliance Score: ${complianceScore}/${totalChecks} (${Math.round((complianceScore/totalChecks)*100)}%)`);

    // Verify notification users structure
    if (retrievedAssignment.resource_assignment_notification_users) {
      try {
        const notificationUsers = JSON.parse(retrievedAssignment.resource_assignment_notification_users);
        console.log(`📧 Notification Users Count: ${notificationUsers.length}`);
        
        if (notificationUsers.length > 0) {
          console.log('📋 Notification Users Structure:');
          notificationUsers.forEach((user, index) => {
            console.log(`   ${index + 1}. Name: ${user.name || 'N/A'}, Email: ${user.email || 'N/A'}`);
          });
        }
      } catch (error) {
        console.error('❌ Error parsing notification users:', error.message);
      }
    }

    // Test update functionality
    console.log('\n🔄 Testing assignment update with DSR compliance...');
    const updateSuccess = await db.updateAssignment(assignmentId, {
      am: 'Updated Account Manager',
      resourceAssigned: 'Updated Resource'
    });

    if (updateSuccess) {
      console.log('✅ Assignment update successful');
      
      // Verify emails were updated
      const updatedAssignment = await db.getAssignmentById(assignmentId);
      console.log(`📧 Updated AM Email: ${updatedAssignment.am_email || 'MISSING'}`);
      console.log(`📧 Updated Resource Email: ${updatedAssignment.resource_assigned_email || 'MISSING'}`);
    } else {
      console.log('❌ Assignment update failed');
    }

    // Cleanup
    console.log('\n🧹 Cleaning up test assignment...');
    const deleteSuccess = await db.deleteAssignment(assignmentId);
    
    if (deleteSuccess) {
      console.log('✅ Test assignment deleted successfully');
    } else {
      console.log('❌ Failed to delete test assignment');
    }

    // Final assessment
    console.log('\n🎯 DSR Compliance Assessment:');
    
    if (complianceScore === totalChecks) {
      console.log('✅ FULLY COMPLIANT: All user fields store both names and emails');
      console.log('✅ Resource assignments are now DSR compliant for Webex notifications and email generation');
      return true;
    } else if (complianceScore >= totalChecks * 0.8) {
      console.log('⚠️  MOSTLY COMPLIANT: Most fields are compliant but some improvements needed');
      return false;
    } else {
      console.log('❌ NON-COMPLIANT: Significant DSR compliance issues detected');
      return false;
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

// Run the test
testDSRCompliance()
  .then(success => {
    console.log(`\n🏁 Test completed: ${success ? 'PASSED' : 'FAILED'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });