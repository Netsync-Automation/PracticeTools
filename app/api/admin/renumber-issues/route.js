import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';

export async function POST() {
  try {
    console.log('Starting issue renumbering...');
    
    // Get all issues
    const issues = await db.getAllIssues();
    console.log(`Found ${issues.length} issues`);
    
    if (issues.length === 0) {
      return NextResponse.json({ success: true, message: 'No issues to renumber' });
    }
    
    // Sort by created_at (oldest first)
    issues.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    // Update each issue with sequential numbers
    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i];
      const issueNumber = i + 1;
      
      console.log(`Updating issue ${issue.id} to #${issueNumber}`);
      
      // Update the issue with new number
      await db.updateIssueNumber(issue.id, issueNumber);
    }
    
    // Set the counter for next issue
    const nextCounter = issues.length + 1;
    await db.saveSetting('issue_counter', nextCounter.toString());
    
    console.log(`✅ Successfully renumbered ${issues.length} issues`);
    
    return NextResponse.json({ 
      success: true, 
      message: `Successfully renumbered ${issues.length} issues. Next issue will be #${nextCounter}` 
    });
    
  } catch (error) {
    console.error('Error renumbering issues:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to renumber issues' 
    }, { status: 500 });
  }
}