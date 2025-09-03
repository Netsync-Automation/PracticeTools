import { db } from '../lib/dynamodb.js';

async function updateExistingAssignments() {
  console.log('Updating existing assignment numbers...');
  
  const assignments = [
    { id: '0416f218-cfff-4731-8d4e-c987baaa3947', number: 1 },
    { id: '6ce6a2e3-50b4-4f56-b3e8-c5c5be44a263', number: 2 }
  ];
  
  for (const assignment of assignments) {
    console.log(`Updating assignment ${assignment.id} to number ${assignment.number}...`);
    const success = await db.updateAssignmentNumber(assignment.id, assignment.number);
    if (success) {
      console.log(`✅ Successfully updated assignment ${assignment.id} to #${assignment.number}`);
    } else {
      console.log(`❌ Failed to update assignment ${assignment.id}`);
    }
  }
  
  // Set the counter to 2 so next assignment will be #3
  console.log('Setting assignment counter to 2...');
  await db.saveSetting('assignment_counter', '2');
  console.log('✅ Assignment counter set to 2');
  
  console.log('Update complete!');
}

updateExistingAssignments().catch(console.error);