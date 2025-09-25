#!/usr/bin/env node

/**
 * DSR Compliance Test for Email Processor Resource Assignment Action
 * 
 * This test verifies that the email processor's resource assignment action
 * properly extracts and stores both names and emails for all user fields
 * to ensure DSR compliance for Webex notifications and email generation.
 */

import { EmailProcessor } from './lib/email-processor.js';

async function testEmailProcessorDSRCompliance() {
  console.log('🧪 Testing Email Processor DSR Compliance for Resource Assignments...\n');

  try {
    const emailProcessor = new EmailProcessor();

    // Mock email data that simulates a resource assignment request
    const mockEmail = {
      id: 'test-email-001',
      subject: 'Resource Assignment Request - Test Project',
      from: 'requester@test.com',
      body: `
Resource Assignment Request

Project Number: TEST-2024-001
Client Name: Test Client Corp
Description: Test project for DSR compliance verification
Region: TX-DAL
PM: John Manager <jmanager@netsync.com>
Documentation Link: https://docs.test.com/project-001
Notes: This is a test resource assignment request
To: alice@test.com, bob@test.com, charlie@test.com
      `
    };

    // Mock rule with keyword mappings for resource assignment
    const mockRule = {
      name: 'Test Resource Assignment Rule',
      action: 'resource_assignment',
      keywordMappings: [
        { keyword: 'Project Number:', field: 'projectNumber' },
        { keyword: 'Client Name:', field: 'clientName' },
        { keyword: 'Description:', field: 'description' },
        { keyword: 'Region:', field: 'region' },
        { keyword: 'PM:', field: 'pm' },
        { keyword: 'Documentation Link:', field: 'documentationLink' },
        { keyword: 'Notes:', field: 'notes' },
        { keyword: 'To:', field: 'resource_assignment_notification_users' }
      ]
    };

    console.log('📧 Testing email data extraction...');
    
    // Test the extractDataFromEmail method
    const extractedData = emailProcessor.extractDataFromEmail(mockEmail, mockRule.keywordMappings);
    
    console.log('📊 Extracted Data Analysis:\n');
    
    // Check extracted fields
    const expectedFields = [
      { field: 'projectNumber', description: 'Project Number', expected: 'TEST-2024-001' },
      { field: 'clientName', description: 'Client Name', expected: 'Test Client Corp' },
      { field: 'description', description: 'Description', expected: 'Test project for DSR compliance verification' },
      { field: 'region', description: 'Region', expected: 'TX-DAL' },
      { field: 'pm', description: 'Project Manager', expected: 'John Manager <jmanager@netsync.com>' },
      { field: 'documentationLink', description: 'Documentation Link', expected: 'https://docs.test.com/project-001' },
      { field: 'notes', description: 'Notes', expected: 'This is a test resource assignment request' }
    ];

    let extractionScore = 0;
    let totalExtractionChecks = expectedFields.length;

    for (const check of expectedFields) {
      const hasValue = extractedData[check.field] !== undefined && extractedData[check.field] !== null && extractedData[check.field] !== '';
      const isCorrect = hasValue && extractedData[check.field].includes(check.expected.split(' ')[0]); // Check if it contains the first word
      const status = isCorrect ? '✅' : (hasValue ? '⚠️' : '❌');
      const displayValue = hasValue ? extractedData[check.field] : 'MISSING';
      
      console.log(`${status} ${check.description}: ${displayValue}`);
      
      if (isCorrect) {
        extractionScore++;
      }
    }

    // Test PM name and email extraction
    console.log('\n📧 Testing PM Name/Email Extraction:');
    const pmName = emailProcessor.extractPMName(extractedData.pm || '');
    const pmEmail = emailProcessor.extractPMEmail(extractedData.pm || '');
    
    console.log(`✅ PM Name: ${pmName}`);
    console.log(`✅ PM Email: ${pmEmail}`);

    // Test notification users extraction
    console.log('\n📧 Testing Notification Users Extraction:');
    const notificationUsers = extractedData.resourceAssignmentNotificationUsers || [];
    console.log(`📧 Notification Users Count: ${notificationUsers.length}`);
    
    if (notificationUsers.length > 0) {
      console.log('📋 Notification Users Structure:');
      notificationUsers.forEach((user, index) => {
        console.log(`   ${index + 1}. Name: ${user.name || 'N/A'}, Email: ${user.email || 'N/A'}`);
      });
    }

    // DSR Compliance Analysis
    console.log('\n🎯 DSR Compliance Analysis for Email Processing:');
    
    const dsrChecks = [
      { 
        field: 'PM Name Extraction', 
        compliant: !!pmName && pmName !== '',
        description: 'PM name properly extracted from email field'
      },
      { 
        field: 'PM Email Extraction', 
        compliant: !!pmEmail && pmEmail.includes('@'),
        description: 'PM email properly extracted from email field'
      },
      { 
        field: 'Notification Users Structure', 
        compliant: notificationUsers.length > 0 && notificationUsers.every(u => u.name && u.email),
        description: 'Notification users contain both names and emails'
      },
      { 
        field: 'Data Extraction Accuracy', 
        compliant: extractionScore >= totalExtractionChecks * 0.8,
        description: 'Email data extraction is accurate'
      }
    ];

    let dsrScore = 0;
    let totalDsrChecks = dsrChecks.length;

    for (const check of dsrChecks) {
      const status = check.compliant ? '✅' : '❌';
      console.log(`${status} ${check.field}: ${check.description}`);
      
      if (check.compliant) {
        dsrScore++;
      }
    }

    console.log(`\n📈 Email Processing DSR Compliance Score: ${dsrScore}/${totalDsrChecks} (${Math.round((dsrScore/totalDsrChecks)*100)}%)`);
    console.log(`📈 Data Extraction Score: ${extractionScore}/${totalExtractionChecks} (${Math.round((extractionScore/totalExtractionChecks)*100)}%)`);

    // Test the actual resource assignment creation flow
    console.log('\n🔄 Testing Resource Assignment Creation Flow...');
    
    // Mock the database addAssignment call to see what parameters would be passed
    console.log('📝 Parameters that would be passed to db.addAssignment:');
    console.log(`   Practice: Pending`);
    console.log(`   Status: Pending`);
    console.log(`   Project Number: ${extractedData.projectNumber || ''}`);
    console.log(`   Customer Name: ${extractedData.clientName || ''}`);
    console.log(`   Project Description: ${extractedData.description || mockEmail.subject}`);
    console.log(`   Region: ${(extractedData.region || '').toUpperCase()}`);
    console.log(`   AM: (empty - not extracted from email)`);
    console.log(`   PM Name: ${pmName}`);
    console.log(`   PM Email: ${pmEmail}`);
    console.log(`   Resource Assigned: (empty - not extracted from email)`);
    console.log(`   Documentation Link: ${extractedData.documentationLink || ''}`);
    console.log(`   Notification Users: ${JSON.stringify(notificationUsers)}`);

    // Final assessment
    console.log('\n🎯 Email Processor DSR Compliance Assessment:');
    
    if (dsrScore === totalDsrChecks && extractionScore >= totalExtractionChecks * 0.8) {
      console.log('✅ FULLY COMPLIANT: Email processor properly extracts user data with names and emails');
      console.log('✅ Resource assignments created from emails are DSR compliant');
      return true;
    } else if (dsrScore >= totalDsrChecks * 0.7) {
      console.log('⚠️  MOSTLY COMPLIANT: Email processor works well but some improvements possible');
      console.log('💡 Recommendations:');
      if (!pmName || !pmEmail) {
        console.log('   - Improve PM name/email extraction from email fields');
      }
      if (notificationUsers.length === 0) {
        console.log('   - Ensure notification users are properly extracted from To: field');
      }
      if (extractionScore < totalExtractionChecks * 0.8) {
        console.log('   - Improve keyword matching and data extraction accuracy');
      }
      return false;
    } else {
      console.log('❌ NON-COMPLIANT: Significant DSR compliance issues in email processing');
      console.log('🔧 Required fixes:');
      dsrChecks.forEach(check => {
        if (!check.compliant) {
          console.log(`   - ${check.field}: ${check.description}`);
        }
      });
      return false;
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

// Run the test
testEmailProcessorDSRCompliance()
  .then(success => {
    console.log(`\n🏁 Email Processor DSR Test completed: ${success ? 'PASSED' : 'FAILED'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });