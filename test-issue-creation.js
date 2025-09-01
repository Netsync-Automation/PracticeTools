#!/usr/bin/env node

import { db } from './lib/dynamodb.js';

async function testIssueCreation() {
  try {
    console.log('🧪 Testing Issue Creation with Practice and Leadership...\n');
    
    // Test data that simulates form submission
    const testData = {
      issue_type: 'Question for leadership',
      title: 'Test Practice and Leadership Storage',
      description: 'Testing if practice and leadership are properly saved',
      email: 'test@example.com',
      practice: 'Collaboration',
      selectedLeadership: ['manager@example.com', 'principal@example.com'],
      attachments: [],
      problem_link: ''
    };
    
    console.log('📋 Test Data:');
    console.log('  - Practice:', testData.practice);
    console.log('  - Selected Leadership:', testData.selectedLeadership);
    console.log('  - Issue Type:', testData.issue_type);
    
    // Create issue using the same method as the API
    console.log('\n🔄 Creating test issue...');
    const issueId = await db.addIssue(
      testData.issue_type,
      testData.title,
      testData.description,
      testData.email,
      testData.attachments,
      testData.problem_link,
      testData.practice,
      testData.selectedLeadership
    );
    
    if (issueId) {
      console.log('✅ Issue created with ID:', issueId);
      
      // Retrieve the issue to verify data was saved
      console.log('\n🔍 Retrieving created issue...');
      const savedIssue = await db.getIssueById(issueId);
      
      if (savedIssue) {
        console.log('📊 Saved Issue Data:');
        console.log('  - Issue Number:', savedIssue.issue_number);
        console.log('  - Practice:', savedIssue.practice || 'NOT SAVED');
        console.log('  - Selected Leadership:', savedIssue.selected_leadership || 'NOT SAVED');
        console.log('  - Issue Type:', savedIssue.issue_type);
        
        // Validation
        const practiceOK = savedIssue.practice === testData.practice;
        const leadershipOK = JSON.stringify(savedIssue.selected_leadership) === JSON.stringify(testData.selectedLeadership);
        
        console.log('\n✅ Validation Results:');
        console.log('  - Practice Saved Correctly:', practiceOK ? '✅ YES' : '❌ NO');
        console.log('  - Leadership Saved Correctly:', leadershipOK ? '✅ YES' : '❌ NO');
        
        if (practiceOK && leadershipOK) {
          console.log('\n🎉 SUCCESS: Practice and Leadership data will save correctly for future issues!');
        } else {
          console.log('\n❌ FAILURE: There are still issues with data saving');
        }
        
        // Clean up test issue
        console.log('\n🧹 Cleaning up test issue...');
        await db.deleteIssue(issueId);
        console.log('✅ Test issue deleted');
        
      } else {
        console.log('❌ Could not retrieve created issue');
      }
    } else {
      console.log('❌ Failed to create test issue');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testIssueCreation();