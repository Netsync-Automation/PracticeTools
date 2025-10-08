import { logger } from './safe-logger.js';

// DSR: Multi-room WebEx notification service with environment-aware SSM parameters
export class WebexMultiRoomService {
  
  // DSR: Get WebEx configuration for specific practice and room
  static async getWebexConfig(practice, roomNumber = 1) {
    console.log(`[DEBUG] getWebexConfig called - Practice: ${practice}, Room: ${roomNumber}`);
    try {
      const { db } = await import('./dynamodb');
      const practiceBot = await db.getPracticeWebexBot(practice);
      console.log(`[DEBUG] Practice bot lookup result:`, practiceBot);
      
      if (!practiceBot || !practiceBot.ssmPrefix) {
        console.log(`[DEBUG] No WebEx bot configured for practice: ${practice}`);
        return null;
      }
      
      const { SSMClient, GetParameterCommand } = await import('@aws-sdk/client-ssm');
      const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
      const ENV = process.env.ENVIRONMENT || 'dev';
      
      // DSR: Environment-aware SSM parameter paths
      const envPrefix = ENV === 'prod' ? '/PracticeTools/' : `/PracticeTools/${ENV}/`;
      
      try {
        // Get access token (shared across all rooms)
        const tokenParam = `${envPrefix}WEBEX_${practiceBot.ssmPrefix}_ACCESS_TOKEN`;
        console.log(`[DEBUG] Token parameter: ${tokenParam}`);
        const tokenCommand = new GetParameterCommand({ Name: tokenParam });
        const tokenResult = await ssmClient.send(tokenCommand);
        const token = tokenResult.Parameter?.Value;
        
        if (!token) {
          console.log(`[DEBUG] No WebEx token available for practice: ${practice}`);
          return null;
        }
        console.log(`[DEBUG] Token retrieved successfully`);
        
        // DSR: Get room-specific parameters using proper numbering convention
        let roomIdParam, roomNameParam;
        if (roomNumber === 1) {
          // Room 1 uses legacy naming (no number suffix for room name)
          roomIdParam = `${envPrefix}WEBEX_${practiceBot.ssmPrefix}_ROOM_ID_1`;
          roomNameParam = `${envPrefix}WEBEX_${practiceBot.ssmPrefix}_ROOM_NAME`;
        } else {
          // Room 2+ uses numbered naming convention
          roomIdParam = `${envPrefix}WEBEX_${practiceBot.ssmPrefix}_ROOM_ID_${roomNumber}`;
          roomNameParam = `${envPrefix}WEBEX_${practiceBot.ssmPrefix}_ROOM_NAME_${roomNumber}`;
        }
        
        console.log(`[DEBUG] Room parameters - ID: ${roomIdParam}, Name: ${roomNameParam}`);
        
        const roomIdCommand = new GetParameterCommand({ Name: roomIdParam });
        const roomNameCommand = new GetParameterCommand({ Name: roomNameParam });
        
        const [roomIdResult, roomNameResult] = await Promise.all([
          ssmClient.send(roomIdCommand),
          ssmClient.send(roomNameCommand)
        ]);
        
        const config = {
          token,
          roomId: roomIdResult.Parameter?.Value,
          roomName: roomNameResult.Parameter?.Value,
          ssmPrefix: practiceBot.ssmPrefix
        };
        
        console.log(`[DEBUG] WebEx config retrieved:`, { ...config, token: token ? '[REDACTED]' : null });
        return config;
        
      } catch (error) {
        console.log(`WebEx configuration not found for practice ${practice}, room ${roomNumber}:`, error.message);
        return null;
      }
      
    } catch (error) {
      console.error('Error getting WebEx configuration:', error);
      return null;
    }
  }
  
  // DSR: Send notifications to Practice Issues room (Room 1)
  static async sendIssueNotifications(issue, comments, commentAuthor) {
    return this.sendNotifications(issue.practice, 1, 'issue', {
      issue,
      comments,
      commentAuthor
    });
  }
  
  // DSR: Send notifications to Resource Assignment room (Room 2)
  static async sendResourceAssignmentNotifications(assignment, type = 'unassigned') {
    console.log(`[DEBUG] sendResourceAssignmentNotifications called - Assignment ID: ${assignment.id}, Type: ${type}, Practice: ${assignment.practice}`);
    
    if (type !== 'unassigned') {
      console.log(`[DEBUG] Skipping notification - type is not 'unassigned': ${type}`);
      return false; // Only send notifications for unassigned status
    }
    
    // DSR: Parse practice from assignment (handle comma-separated practices)
    const practices = assignment.practice ? assignment.practice.split(',').map(p => p.trim()) : [];
    console.log(`[DEBUG] Parsed practices:`, practices);
    let successCount = 0;
    
    for (const practice of practices) {
      console.log(`[DEBUG] Processing practice: ${practice}`);
      const result = await this.sendNotifications(practice, 2, 'resource_assignment', {
        assignment,
        type
      });
      console.log(`[DEBUG] Notification result for practice ${practice}:`, result);
      if (result) successCount++;
    }
    
    console.log(`[DEBUG] Total successful notifications: ${successCount}`);
    return successCount > 0;
  }
  
  // DSR: Core notification sending logic
  static async sendNotifications(practice, roomNumber, notificationType, data) {
    console.log(`[DEBUG] sendNotifications called - Practice: ${practice}, Room: ${roomNumber}, Type: ${notificationType}`);
    try {
      const config = await this.getWebexConfig(practice, roomNumber);
      if (!config) {
        console.log(`[DEBUG] No WebEx config found for practice: ${practice}, room: ${roomNumber}`);
        return false;
      }
      
      let adaptiveCard;
      
      if (notificationType === 'issue') {
        adaptiveCard = await this.buildIssueCard(data.issue, data.comments);
        // DSR: Issues still use individual participant notifications
        const participants = await this.getIssueParticipants(data.issue, data.comments, data.commentAuthor);
        
        if (!adaptiveCard || participants.size === 0) {
          console.log(`[DEBUG] Skipping issue notification - adaptiveCard: ${!!adaptiveCard}, participants: ${participants.size}`);
          return false;
        }
        
        let successCount = 0;
        for (const participantEmail of participants) {
          try {
            const response = await fetch('https://webexapis.com/v1/messages', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${config.token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                toPersonEmail: participantEmail,
                text: `Notification from ${config.roomName}`,
                attachments: [{
                  contentType: "application/vnd.microsoft.card.adaptive",
                  content: adaptiveCard
                }]
              })
            });
            
            if (response.ok) successCount++;
          } catch (error) {
            console.error(`Error sending notification to ${participantEmail}:`, error);
          }
        }
        return successCount > 0;
        
      } else if (notificationType === 'resource_assignment') {
        console.log(`[DEBUG] Building resource assignment card for assignment:`, data.assignment.id);
        adaptiveCard = await this.buildResourceAssignmentCard(data.assignment);
        
        if (!adaptiveCard) {
          console.log(`[DEBUG] Skipping resource assignment notification - no card built`);
          return false;
        }
        
        // DSR: Resource assignments post directly to the room
        console.log(`[DEBUG] Posting resource assignment notification to room: ${config.roomName} (${config.roomId})`);
        
        try {
          const response = await fetch('https://webexapis.com/v1/messages', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${config.token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              roomId: config.roomId,
              text: `Resource Assignment Update from ${config.roomName}`,
              attachments: [{
                contentType: "application/vnd.microsoft.card.adaptive",
                content: adaptiveCard
              }]
            })
          });
          
          if (response.ok) {
            console.log(`[DEBUG] Successfully posted resource assignment notification to room`);
            return true;
          } else {
            console.log(`[DEBUG] Failed to post to room, status: ${response.status}`);
            const errorText = await response.text();
            console.log(`[DEBUG] Error response:`, errorText);
            return false;
          }
        } catch (error) {
          console.error('Error posting resource assignment notification to room:', error);
          return false;
        }
      }
      
      return false;
      
    } catch (error) {
      console.error('WebEx multi-room notification error:', error);
      return false;
    }
  }
  
  // DSR: Build adaptive card for issue notifications
  static async buildIssueCard(issue, comments) {
    const { formatDateForWebEx } = await import('./webex-notifications.js');
    const lastThreeComments = comments.slice(-3);
    let baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
    baseUrl = baseUrl.replace(/\/$/, '');
    if (!baseUrl.startsWith('http')) {
      baseUrl = `https://${baseUrl}`;
    }
    
    return {
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
        try {
          new URL(action.url);
          return true;
        } catch {
          console.error('Invalid URL for WebEx action:', action.url);
          return false;
        }
      })
    };
  }
  
  // DSR: Get participants for issue notifications
  static async getIssueParticipants(issue, comments, commentAuthor) {
    const { db } = await import('./dynamodb');
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
    
    // DSR: Filter to only users who are following the issue
    const filteredParticipants = new Set();
    for (const participantEmail of participants) {
      const isFollowing = await db.isUserFollowingIssue(issue.id, participantEmail);
      if (isFollowing) {
        filteredParticipants.add(participantEmail);
      }
    }
    
    return filteredParticipants;
  }
  
  // DSR: Build adaptive card for resource assignment notifications
  static async buildResourceAssignmentCard(assignment) {
    const { formatDateForWebEx } = await import('./webex-notifications.js');
    let baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
    baseUrl = baseUrl.replace(/\/$/, '');
    if (!baseUrl.startsWith('http')) {
      baseUrl = `https://${baseUrl}`;
    }
    
    return {
      type: "AdaptiveCard",
      version: "1.3",
      body: [
        {
          type: "TextBlock",
          text: "📋 New Project - Resource Request",
          size: "Large",
          weight: "Bolder",
          color: "Accent"
        },
        {
          type: "TextBlock",
          text: `Project #${assignment.projectNumber || 'N/A'}`,
          size: "Medium",
          weight: "Bolder",
          wrap: true
        },
        {
          type: "FactSet",
          facts: [
            {
              title: "Customer:",
              value: assignment.customerName || 'N/A'
            },
            {
              title: "Project Manager:",
              value: assignment.pm || 'N/A'
            },
            {
              title: "Account Manager:",
              value: assignment.am || 'N/A'
            },
            {
              title: "Region:",
              value: assignment.region || 'N/A'
            },
            {
              title: "ETA:",
              value: assignment.eta ? formatDateForWebEx(assignment.eta, process.env.DEFAULT_TIMEZONE) : 'N/A'
            }
          ]
        },
        {
          type: "TextBlock",
          text: "Project Description:",
          weight: "Bolder",
          spacing: "Medium"
        },
        {
          type: "TextBlock",
          text: assignment.projectDescription || 'No description provided',
          wrap: true,
          spacing: "Small"
        }
      ].concat(assignment.notes ? [
        {
          type: "TextBlock",
          text: "Notes:",
          weight: "Bolder",
          spacing: "Medium"
        },
        {
          type: "TextBlock",
          text: assignment.notes,
          wrap: true,
          spacing: "Small",
          style: "emphasis"
        }
      ] : []),
      actions: [
        {
          type: "Action.OpenUrl",
          title: "View Project Details",
          url: `${baseUrl}/projects/resource-assignments/${assignment.id}`
        },
        {
          type: "Action.OpenUrl",
          title: "View Documentation",
          url: assignment.projectNumber ? 
            `https://savant.netsync.com/v2/pmo/projects/details/documentation?jobNo=${assignment.projectNumber}&isPmo=true` :
            `${baseUrl}/projects/resource-assignments/${assignment.id}`
        }
      ].filter(action => {
        try {
          new URL(action.url);
          return true;
        } catch {
          console.error('Invalid URL for WebEx action:', action.url);
          return false;
        }
      })
    };
  }
  

}