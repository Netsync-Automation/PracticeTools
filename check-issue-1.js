#!/usr/bin/env node

import { db } from './lib/dynamodb.js';

async function checkIssue1() {
  try {
    console.log('🔍 Checking Issue #1 in DynamoDB...\n');
    
    // Get all issues to find issue #1
    const issues = await db.getAllIssues();
    const issue1 = issues.find(issue => issue.issue_number === 1);
    
    if (issue1) {
      console.log('📋 Issue #1 Found:');
      console.log('  - ID:', issue1.id);
      console.log('  - Title:', issue1.title);
      console.log('  - Practice:', issue1.practice || 'NOT SET');
      console.log('  - System (legacy):', issue1.system || 'NOT SET');
      console.log('  - Selected Leadership:', issue1.selected_leadership || 'NOT SET');
      console.log('  - Issue Type:', issue1.issue_type);
      console.log('  - Created:', issue1.created_at);
      
      console.log('\n📊 Raw Database Fields:');
      console.log(JSON.stringify(issue1, null, 2));
    } else {
      console.log('❌ Issue #1 not found in database');
    }
    
  } catch (error) {
    console.error('❌ Error checking issue:', error);
  }
}

checkIssue1();