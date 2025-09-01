import { logger } from './safe-logger.js';

// Server-safe timezone formatting for WebEx notifications
export function formatDateForWebEx(utcTimestamp, timezone = 'America/Chicago') {
  if (!utcTimestamp) return 'Unknown time';
  
  try {
    const date = new Date(utcTimestamp);
    
    // Get formatted date/time
    const dateTime = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      month: 'numeric',
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(date);
    
    // Get timezone abbreviation
    const timeZoneAbbr = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    }).formatToParts(date).find(part => part.type === 'timeZoneName')?.value || timezone;
    
    return `${dateTime} (${timeZoneAbbr})`;
  } catch (error) {
    logger.error('Date formatting error:', error);
    return new Date(utcTimestamp).toLocaleString();
  }
}

export class WebexNotifications {
  static async sendCommentNotifications(issue, comments, commentAuthor) {
    try {
      // Get practice-specific WebEx bot configuration
      const { db } = await import('./dynamodb');
      const practiceBot = await db.getPracticeWebexBot(issue.practice);
      
      if (!practiceBot || !practiceBot.ssmPrefix) {
        console.log(`No WebEx bot configured for practice: ${issue.practice}`);
        return false;
      }
      
      // Get WebEx token from SSM parameters based on issue practice
      const { SSMClient, GetParameterCommand } = await import('@aws-sdk/client-ssm');
      const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
      const ENV = process.env.ENVIRONMENT || 'dev';
      
      let token;
      try {
        const tokenParam = ENV === 'prod' ? `/PracticeTools/WEBEX_${practiceBot.ssmPrefix}_ACCESS_TOKEN` : `/PracticeTools/${ENV}/WEBEX_${practiceBot.ssmPrefix}_ACCESS_TOKEN`;
        const tokenCommand = new GetParameterCommand({ Name: tokenParam });
        const tokenResult = await ssmClient.send(tokenCommand);
        token = tokenResult.Parameter?.Value;
      } catch (error) {
        console.log(`WebEx token not found for practice ${issue.practice}:`, error.message);
        return false;
      }
      
      if (!token) {
        console.log(`No WebEx token available for practice: ${issue.practice}`);
        return false;
      }

      const participants = new Set();
      participants.add(issue.email);
      
      comments.forEach(comment => {
        if (comment.user_email && comment.user_email !== commentAuthor.email) {
          participants.add(comment.user_email);
        }
      });
      
      const followers = await db.getIssueFollowers(issue.id);
      followers.forEach(follower => {
        if (follower.user_email !== commentAuthor.email) {
          participants.add(follower.user_email);
        }
      });

      const lastThreeComments = comments.slice(-3);
      let baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      
      // Ensure baseUrl is valid and doesn't end with slash
      baseUrl = baseUrl.replace(/\/$/, '');
      if (!baseUrl.startsWith('http')) {
        baseUrl = `https://${baseUrl}`;
      }
      
      const adaptiveCard = {
        type: "AdaptiveCard",
        version: "1.3",
        body: [
          {
            type: "TextBlock",
            text: "💬 New Comment Added",
            size: "Large",
            weight: "Bolder",
            color: "Accent"
          },
          {
            type: "TextBlock",
            text: `Issue Number: ${issue.issue_number} - ${issue.title}`,
            size: "Medium",
            weight: "Bolder",
            wrap: true
          },
          {
            type: "TextBlock",
            text: "Recent Comments:",
            weight: "Bolder",
            spacing: "Medium"
          },
          ...lastThreeComments.map(comment => ({
            type: "Container",
            style: "emphasis",
            items: [
              {
                type: "ColumnSet",
                columns: [
                  {
                    type: "Column",
                    width: "auto",
                    items: [
                      {
                        type: "TextBlock",
                        text: comment.user_name || comment.user_email,
                        weight: "Bolder",
                        size: "Small"
                      }
                    ]
                  },
                  {
                    type: "Column",
                    width: "stretch",
                    items: [
                      {
                        type: "TextBlock",
                        text: formatDateForWebEx(comment.created_at, process.env.DEFAULT_TIMEZONE),
                        size: "Small",
                        color: "Default",
                        horizontalAlignment: "Right"
                      }
                    ]
                  }
                ]
              },
              {
                type: "TextBlock",
                text: comment.message,
                wrap: true,
                spacing: "Small"
              }
            ],
            spacing: "Small"
          }))
        ],
        actions: [
          {
            type: "Action.OpenUrl",
            title: "View Full Conversation",
            url: `${baseUrl}/issue/${issue.id}`
          }
        ].filter(action => {
          // Validate URL before including action
          try {
            new URL(action.url);
            return true;
          } catch {
            console.error('Invalid URL for WebEx action:', action.url);
            return false;
          }
        })
      };

      let successCount = 0;
      
      for (const participantEmail of participants) {
        try {
          const isFollowing = await db.isUserFollowingIssue(issue.id, participantEmail);
          
          if (!isFollowing) {
            continue;
          }
          
          const response = await fetch('https://webexapis.com/v1/messages', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              toPersonEmail: participantEmail,
              text: `New comment on Issue ${issue.issue_number}: ${issue.title}`,
              attachments: [{
                contentType: "application/vnd.microsoft.card.adaptive",
                content: adaptiveCard
              }]
            })
          });
          
          if (response.ok) {
            successCount++;
          }
        } catch (error) {
          console.error(`Error processing notification for ${participantEmail}:`, error);
        }
      }
      
      return successCount > 0;
    } catch (error) {
      console.error('WebEx comment notification error:', error);
      return false;
    }
  }

  // Other methods remain the same...
}