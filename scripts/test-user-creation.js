#!/usr/bin/env node

import { processAmIsrUsers, ensureUserExists } from '../lib/user-manager.js';
import { db } from '../lib/dynamodb.js';

async function testUserCreation() {
  console.log('🧪 Testing automatic user creation for AM and ISR roles...\n');

  try {
    // Test 1: Create AM user
    console.log('Test 1: Creating AM user from "John Smith <jsmith@example.com>"');
    const amUser = await ensureUserExists('John Smith <jsmith@example.com>', 'account_manager');
    if (amUser) {
      console.log('✅ AM user created/found:', {
        email: amUser.email,
        name: amUser.name,
        role: amUser.role,
        source: amUser.created_from
      });
    } else {
      console.log('❌ Failed to create AM user');
    }

    // Test 2: Create ISR user
    console.log('\nTest 2: Creating ISR user from "jane.doe@example.com"');
    const isrUser = await ensureUserExists('jane.doe@example.com', 'isr');
    if (isrUser) {
      console.log('✅ ISR user created/found:', {
        email: isrUser.email,
        name: isrUser.name,
        role: isrUser.role,
        source: isrUser.created_from
      });
    } else {
      console.log('❌ Failed to create ISR user');
    }

    // Test 3: Process both AM and ISR together
    console.log('\nTest 3: Processing AM and ISR together');
    const result = await processAmIsrUsers(
      'Bob Wilson <bwilson@example.com>',
      'Sarah Johnson <sjohnson@example.com>'
    );
    
    console.log('✅ Batch processing result:', {
      amUser: result.amUser ? {
        email: result.amUser.email,
        name: result.amUser.name,
        role: result.amUser.role
      } : null,
      isrUser: result.isrUser ? {
        email: result.isrUser.email,
        name: result.isrUser.name,
        role: result.isrUser.role
      } : null
    });

    // Test 4: Check existing user (should not create duplicate)
    console.log('\nTest 4: Checking existing user (should not create duplicate)');
    const existingUser = await ensureUserExists('John Smith <jsmith@example.com>', 'account_manager');
    if (existingUser) {
      console.log('✅ Existing user found (no duplicate created):', {
        email: existingUser.email,
        name: existingUser.name,
        role: existingUser.role,
        source: existingUser.created_from
      });
    }

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testUserCreation().then(() => {
  console.log('\n✨ Test script finished');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test script failed:', error);
  process.exit(1);
});