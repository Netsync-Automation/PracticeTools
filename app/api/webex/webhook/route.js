import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';
import { WebexSync } from '../../../../lib/webex-sync';

export async function POST(request) {
  try {
    const webhookData = await request.json();
    
    // Handle adaptive card submit actions
    if (webhookData.resource === 'attachmentActions') {
      const actionData = webhookData.data;
      
      if (actionData.inputs?.action === 'upvote') {
        const issueId = actionData.inputs.issue_id;
        const userEmail = actionData.personEmail;
        const userName = actionData.personDisplayName;
        
        if (!issueId || !userEmail) {
          return NextResponse.json({ error: 'Missing required data' }, { status: 400 });
        }
        
        // Sync user from WebEx space
        await WebexSync.syncUserOnAction(userEmail, userName);
        
        const result = await db.upvoteIssue(issueId, userEmail);
        
        // Send response back to WebEx
        const token = process.env.WEBEX_SCOOP_ACCESS_TOKEN;
        const responseMessage = result.success 
          ? `✅ Your upvote has been recorded!`
          : `❌ ${result.alreadyUpvoted ? 'You can only upvote an issue once' : 'Failed to upvote'}`;
        
        if (token) {
          await fetch('https://webexapis.com/v1/messages', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              toPersonEmail: userEmail,
              text: responseMessage
            })
          });
        }
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('WebEx webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}