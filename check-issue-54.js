import { db } from './lib/dynamodb.js';

async function checkIssue54() {
  try {
    const allIssues = await db.getAllIssues();
    const issue54 = allIssues.find(issue => issue.issue_number === 54);
    
    if (issue54) {
      console.log(`Issue #54 Status: ${issue54.status}`);
      console.log(`Last Updated: ${issue54.last_updated_at}`);
    } else {
      console.log('Issue #54 not found');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkIssue54();