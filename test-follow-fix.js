const { db } = require('./lib/dynamodb.js');

async function testFollowFix() {
  console.log('=== TESTING FOLLOW FIX ===');
  
  const testEmail = 'mbgriffin@netsync.com';
  const testIssueIds = ['1758034675705', '1758034589074']; // The Singlewire cards
  
  for (const issueId of testIssueIds) {
    console.log(`\n--- Testing Issue ID: ${issueId} ---`);
    
    // Get issue details
    const issue = await db.getIssueById(issueId);
    if (issue) {
      console.log(`Issue: "${issue.title}"`);
      console.log(`Created by: ${issue.email}`);
      console.log(`Is user creator: ${issue.email === testEmail}`);
    } else {
      console.log('Issue not found');
      continue;
    }
    
    // Check follow status using the fixed function
    const isFollowing = await db.isUserFollowingIssue(issueId, testEmail);
    console.log(`Follow status result: ${isFollowing}`);
    
    // Check comments
    const comments = await db.getComments(issueId);
    const hasCommented = comments.some(comment => comment.user_email === testEmail);
    console.log(`Has commented: ${hasCommented}`);
    console.log(`Comments count: ${comments.length}`);
    
    // Check database followers
    const followers = await db.getIssueFollowers(issueId);
    console.log(`Database followers count: ${followers.length}`);
    if (followers.length > 0) {
      console.log('Followers:', followers.map(f => f.user_email));
    }
  }
}

testFollowFix().catch(console.error);