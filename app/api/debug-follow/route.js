import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb';
import { GetItemCommand } from '@aws-sdk/client-dynamodb';

const ENV = process.env.ENVIRONMENT || 'prod';
const FOLLOWERS_TABLE = `PracticeTools-${ENV}-Followers`;
const UPVOTES_TABLE = `PracticeTools-${ENV}-Upvotes`;
const RELEASES_TABLE = `PracticeTools-${ENV}-Releases`;

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const issueId = searchParams.get('issueId');
    const userEmail = searchParams.get('userEmail');
    
    if (!issueId || !userEmail) {
      return NextResponse.json({ error: 'issueId and userEmail required' }, { status: 400 });
    }
    
    // Check explicit follow record
    const command = new GetItemCommand({
      TableName: FOLLOWERS_TABLE,
      Key: {
        issue_id: { S: issueId },
        user_email: { S: userEmail }
      }
    });
    
    const result = await db.client.send(command);
    const explicitRecord = result.Item ? {
      issue_id: result.Item.issue_id?.S,
      user_email: result.Item.user_email?.S,
      status: result.Item.status?.S || 'following',
      created_at: result.Item.created_at?.S
    } : null;
    
    // Check computed follow status
    const isFollowing = await db.isUserFollowingIssue(issueId, userEmail);
    
    // Get issue and comments for context
    const issue = await db.getIssueById(issueId);
    const comments = await db.getComments(issueId);
    const isCreator = issue && issue.email === userEmail;
    const hasCommented = comments.some(comment => comment.user_email === userEmail);
    
    return NextResponse.json({
      issueId,
      userEmail,
      explicitRecord,
      computedFollowStatus: isFollowing,
      isCreator,
      hasCommented,
      shouldAutoFollow: isCreator || hasCommented
    });
  } catch (error) {
    console.error('Debug follow error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { issueId, userEmail, action } = await request.json();
    
    if (!issueId || !userEmail || !action) {
      return NextResponse.json({ error: 'issueId, userEmail, and action required' }, { status: 400 });
    }
    
    if (action === 'force_unfollow') {
      // Force set to unfollowed status
      const { PutItemCommand } = await import('@aws-sdk/client-dynamodb');
      const command = new PutItemCommand({
        TableName: FOLLOWERS_TABLE,
        Item: {
          issue_id: { S: issueId },
          user_email: { S: userEmail },
          status: { S: 'unfollowed' },
          created_at: { S: new Date().toISOString() }
        }
      });
      
      await db.client.send(command);
      
      // Verify the status was set correctly
      const verifyResult = await db.isUserFollowingIssue(issueId, userEmail);
      
      return NextResponse.json({ 
        success: true, 
        message: `Forced ${userEmail} to unfollowed status for issue ${issueId}`,
        verifiedStatus: verifyResult
      });
    }
    
    if (action === 'cleanup_mike') {
      // Special cleanup for mike@irgriffin.com
      const { PutItemCommand } = await import('@aws-sdk/client-dynamodb');
      const command = new PutItemCommand({
        TableName: FOLLOWERS_TABLE,
        Item: {
          issue_id: { S: 'ca83f8ce-079b-4f43-8cf9-f6320a628634' },
          user_email: { S: 'mike@irgriffin.com' },
          status: { S: 'unfollowed' },
          created_at: { S: new Date().toISOString() }
        }
      });
      
      await db.client.send(command);
      
      // Verify cleanup
      const followers = await db.getIssueFollowers('ca83f8ce-079b-4f43-8cf9-f6320a628634');
      const mikeInFollowers = followers.some(f => f.user_email === 'mike@irgriffin.com');
      const followStatus = await db.isUserFollowingIssue('ca83f8ce-079b-4f43-8cf9-f6320a628634', 'mike@irgriffin.com');
      
      return NextResponse.json({ 
        success: true, 
        message: 'Cleaned up mike@irgriffin.com follow status',
        mikeInFollowersList: mikeInFollowers,
        mikeFollowStatus: followStatus,
        totalFollowers: followers.length
      });
    }
    
    if (action === 'check_followers') {
      // Check current followers for the issue
      const followers = await db.getIssueFollowers(issueId);
      const allFollowRecords = [];
      
      // Get all records for this issue (including unfollowed)
      const { ScanCommand } = await import('@aws-sdk/client-dynamodb');
      const scanCommand = new ScanCommand({
        TableName: FOLLOWERS_TABLE,
        FilterExpression: 'issue_id = :issueId',
        ExpressionAttributeValues: {
          ':issueId': { S: issueId }
        }
      });
      
      const scanResult = await db.client.send(scanCommand);
      const allRecords = (scanResult.Items || []).map(item => ({
        user_email: item.user_email?.S,
        status: item.status?.S || 'following',
        created_at: item.created_at?.S
      }));
      
      return NextResponse.json({
        issueId,
        activeFollowers: followers,
        allRecords: allRecords
      });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Debug follow action error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}