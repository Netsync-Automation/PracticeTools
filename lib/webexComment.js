export async function sendWebexCommentCard(issue, comment, action = 'added') {
  const token = process.env.WEBEX_SCOOP_ACCESS_TOKEN;
  const roomId = process.env.WEBEX_SCOOP_ROOM_ID_1;
  
  console.log('WebEx comment integration:', { hasToken: !!token, hasRoomId: !!roomId, action, issueId: issue.id });
  
  if (!token || !roomId) {
    console.log('WebEx not configured - missing token or room ID');
    return;
  }

  const card = {
    type: "AdaptiveCard",
    version: "1.3",
    body: [
      {
        type: "TextBlock",
        text: `Comment ${action.toUpperCase()} - Issue #${issue.issue_number}`,
        weight: "Bolder",
        size: "Medium",
        color: "Accent"
      },
      {
        type: "TextBlock",
        text: issue.title,
        weight: "Bolder",
        wrap: true,
        spacing: "Medium"
      },
      {
        type: "TextBlock",
        text: `Comment by: ${comment.created_by || comment.email}`,
        spacing: "Small",
        isSubtle: true
      },
      {
        type: "TextBlock",
        text: comment.message || "Attachment only comment",
        wrap: true,
        spacing: "Medium"
      }
    ],
    actions: [
      {
        type: "Action.OpenUrl",
        title: "View Conversation",
        url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/issue/${issue.id}`
      }
    ]
  };

  // Add attachments info if they exist
  try {
    const attachments = JSON.parse(comment.attachments || '[]');
    if (attachments.length > 0) {
      card.body.push({
        type: "TextBlock",
        text: `📎 ${attachments.length} attachment(s) included`,
        spacing: "Small",
        isSubtle: true
      });
    }
  } catch (e) {
    // Ignore JSON parse errors
  }

  try {
    console.log('Sending WebEx comment card to room:', roomId);
    const response = await fetch('https://webexapis.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        roomId,
        attachments: [{
          contentType: "application/vnd.microsoft.card.adaptive",
          content: card
        }]
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('WebEx API error:', response.status, errorText);
    } else {
      console.log('WebEx comment card sent successfully');
    }
  } catch (error) {
    console.error('Error sending Webex comment card:', error);
  }
}