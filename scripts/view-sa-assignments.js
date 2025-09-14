import { db } from '../lib/dynamodb.js';

async function viewSaAssignments() {
  try {
    console.log('Fetching all SA assignments...\n');
    
    const saAssignments = await db.getAllSaAssignments();
    
    if (saAssignments.length === 0) {
      console.log('No SA assignments found in the database.');
      return;
    }
    
    console.log(`Found ${saAssignments.length} SA assignments:\n`);
    
    saAssignments.forEach((sa, index) => {
      console.log(`--- SA Assignment #${index + 1} ---`);
      console.log(`ID: ${sa.id}`);
      console.log(`SA Assignment Number: ${sa.sa_assignment_number}`);
      console.log(`Opportunity ID: ${sa.opportunityId || 'NOT SET'}`);
      console.log(`Opportunity Name: ${sa.opportunityName || 'NOT SET'}`);
      console.log(`Practice: ${sa.practice}`);
      console.log(`Status: ${sa.status}`);
      console.log(`Customer: ${sa.customerName}`);
      console.log(`Region: ${sa.region}`);
      console.log(`AM: ${sa.am || 'NOT SET'}`);
      console.log(`ISR: ${sa.isr || 'NOT SET'}`);
      console.log(`Submitted By: ${sa.submittedBy || 'NOT SET'}`);
      console.log(`SA Assigned: ${sa.saAssigned}`);
      console.log(`Request Date: ${sa.requestDate}`);
      console.log(`ETA: ${sa.eta}`);
      console.log(`Notes: ${sa.notes}`);
      console.log(`SCOOP URL: ${sa.scoopUrl}`);
      console.log(`Created: ${sa.created_at}`);
      console.log(`Updated: ${sa.updated_at}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error fetching SA assignments:', error);
  }
}

viewSaAssignments();