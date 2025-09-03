#!/usr/bin/env node

import { db } from './lib/dynamodb.js';
import { sendWebexCard } from './lib/webex.js';

async function debugWebexIssue3() {
  try {
    console.log('🔍 Debugging WebEx notification for Issue #3...\n');
    
    // Get Issue #3
    const issues = await db.getAllIssues();
    const issue3 = issues.find(issue => issue.issue_number === 3);
    
    if (!issue3) {
      console.log('❌ Issue #3 not found');
      return;
    }
    
    console.log('📋 Issue #3 Details:');
    console.log('  - ID:', issue3.id);
    console.log('  - Title:', issue3.title);
    console.log('  - Type:', issue3.issue_type);
    console.log('  - Practice:', issue3.practice);
    console.log('  - Created:', issue3.created_at);
    
    // Test WebEx notification manually
    console.log('\n🚀 Testing WebEx notification...');
    const result = await sendWebexCard(issue3, 'created');
    
    console.log('\n📊 WebEx Result:');
    console.log('  - Success:', result.success);
    if (result.error) {
      console.log('  - Error:', result.error);
    }
    if (result.messageId) {
      console.log('  - Message ID:', result.messageId);
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugWebexIssue3();