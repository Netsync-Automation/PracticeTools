#!/usr/bin/env node

import { db } from '../lib/dynamodb.js';
import { AssignmentEmailProcessor } from '../lib/assignment-email-processor.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function fixAssignmentEmails() {
  try {
    console.log('🔧 Starting DSR-compliant email field migration...\n');
    
    const assignments = await db.getAllAssignments();
    console.log(`📋 Found ${assignments.length} assignments to process\n`);
    
    let processed = 0;
    let updated = 0;
    let errors = 0;
    
    for (const assignment of assignments) {
      try {
        processed++;
        console.log(`Processing ${processed}/${assignments.length}: ${assignment.projectNumber} (${assignment.customerName})`);
        
        // Check if emails are missing
        const needsUpdate = !assignment.am_email || 
                           !assignment.pm_email || 
                           !assignment.resource_assigned_email ||
                           this.hasInvalidNotificationEmails(assignment.resource_assignment_notification_users);
        
        if (needsUpdate) {
          const processedAssignment = await AssignmentEmailProcessor.processAssignmentEmails(assignment);
          updated++;
          console.log(`  ✅ Updated emails for assignment ${assignment.id}`);
        } else {
          console.log(`  ⏭️  Already has valid emails`);
        }
        
      } catch (error) {
        errors++;
        console.error(`  ❌ Error processing assignment ${assignment.id}:`, error.message);
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log('====================');
    console.log(`Total Processed: ${processed}`);
    console.log(`Updated: ${updated}`);
    console.log(`Errors: ${errors}`);
    console.log(`Skipped (already valid): ${processed - updated - errors}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  }
}

function hasInvalidNotificationEmails(notificationUsersJson) {
  try {
    const users = JSON.parse(notificationUsersJson || '[]');
    return users.some(user => !user.email || !user.email.includes('@'));
  } catch {
    return true;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixAssignmentEmails();
}

export { fixAssignmentEmails };