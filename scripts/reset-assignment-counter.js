import { db } from '../lib/dynamodb.js';

async function resetAssignmentCounter() {
  console.log('Resetting assignment counter to 0...');
  
  const success = await db.saveSetting('assignment_counter', '0');
  
  if (success) {
    console.log('✅ Assignment counter reset to 0');
    console.log('📋 Next assignment will be ID #1');
  } else {
    console.log('❌ Failed to reset assignment counter');
  }
}

resetAssignmentCounter().catch(console.error);