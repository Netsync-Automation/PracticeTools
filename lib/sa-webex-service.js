import { db } from './dynamodb.js';
import { logger } from './safe-logger.js';
import { getSecureParameter } from './ssm-config.js';

class SAWebexService {
  async createSASpace(saAssignment) {
    try {
      // Check if space already exists
      if (saAssignment.webex_space_id) {
        logger.info('Webex space already exists for SA assignment', { 
          saAssignmentId: saAssignment.id, 
          spaceId: saAssignment.webex_space_id 
        });
        return saAssignment.webex_space_id;
      }

      logger.info('Creating Webex space for SA assignment', { saAssignmentId: saAssignment.id });

      const assignedPractices = saAssignment.practice ? saAssignment.practice.split(',').map(p => p.trim()).sort() : [];
      if (assignedPractices.length === 0) {
        logger.warn('No practices assigned, cannot create Webex space', { saAssignmentId: saAssignment.id });
        return null;
      }

      // Get the first practice alphabetically to determine which bot to use
      const primaryPractice = assignedPractices[0];
      const webexBot = await db.getPracticeWebexBot(primaryPractice);
      
      if (!webexBot || !webexBot.accessToken) {
        logger.warn('No Webex bot found for primary practice', { 
          saAssignmentId: saAssignment.id, 
          primaryPractice: primaryPractice 
        });
        return null;
      }

      // Create space name: OpportunityID-CustomerName-OpportunityName
      const spaceName = `${saAssignment.opportunityId || 'N/A'}-${saAssignment.customerName}-${saAssignment.opportunityName || 'SA Assignment'}`.substring(0, 200);

      // Create the Webex space
      const spaceResponse = await fetch('https://webexapis.com/v1/rooms', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${webexBot.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: spaceName,
          type: 'group'
        })
      });

      if (!spaceResponse.ok) {
        const errorText = await spaceResponse.text();
        logger.error('Failed to create Webex space', { 
          saAssignmentId: saAssignment.id,
          status: spaceResponse.status,
          error: errorText
        });
        return null;
      }

      const space = await spaceResponse.json();
      logger.info('Webex space created successfully', { 
        saAssignmentId: saAssignment.id,
        spaceId: space.id,
        spaceName: spaceName
      });

      // Add users to the space
      await this.addUsersToSpace(space.id, saAssignment, webexBot.accessToken);

      // Send welcome message with SA assignment details
      await this.sendWelcomeMessage(space.id, saAssignment, webexBot.accessToken);

      // Store space ID in SA assignment for future reference
      await this.updateSAAssignmentWithSpaceId(saAssignment.id, space.id);

      return space.id;
    } catch (error) {
      logger.error('Error creating Webex space', { 
        saAssignmentId: saAssignment.id,
        error: error.message,
        stack: error.stack
      });
      return null;
    }
  }

  async addUsersToSpace(spaceId, saAssignment, accessToken) {
    try {
      const users = await db.getAllUsers();
      const assignedPractices = saAssignment.practice ? saAssignment.practice.split(',').map(p => p.trim()) : [];
      // Extract SAs from new practiceAssignments structure
      let assignedSAs = [];
      if (saAssignment.practiceAssignments) {
        try {
          const practiceAssignments = JSON.parse(saAssignment.practiceAssignments);
          const allSAs = new Set();
          Object.values(practiceAssignments).forEach(saList => {
            if (Array.isArray(saList)) {
              saList.forEach(sa => allSAs.add(sa));
            }
          });
          assignedSAs = Array.from(allSAs);
        } catch (e) {
          logger.error('Error parsing practiceAssignments', { error: e.message });
        }
      }
      // Fallback to legacy saAssigned field
      if (assignedSAs.length === 0 && saAssignment.saAssigned) {
        assignedSAs = saAssignment.saAssigned.split(',').map(r => r.trim());
      }
      const emailsToAdd = new Set();

      // Add AM email
      if (saAssignment.am_email) {
        emailsToAdd.add(saAssignment.am_email);
      } else if (saAssignment.am) {
        const amUser = users.find(user => user.name.toLowerCase() === saAssignment.am.toLowerCase());
        if (amUser && amUser.email) {
          emailsToAdd.add(amUser.email);
        }
      }

      // Add ISR email
      if (saAssignment.isr_email) {
        emailsToAdd.add(saAssignment.isr_email);
      } else if (saAssignment.isr) {
        const emailMatch = saAssignment.isr.match(/<([^>]+)>/) || saAssignment.isr.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
        if (emailMatch) {
          emailsToAdd.add(emailMatch[1] || emailMatch[0]);
        } else {
          const isrUser = users.find(user => user.name.toLowerCase() === saAssignment.isr.toLowerCase());
          if (isrUser && isrUser.email) {
            emailsToAdd.add(isrUser.email);
          }
        }
      }

      // Add Submitted By email
      if (saAssignment.submitted_by_email) {
        emailsToAdd.add(saAssignment.submitted_by_email);
      } else if (saAssignment.submittedBy) {
        const emailMatch = saAssignment.submittedBy.match(/<([^>]+)>/) || saAssignment.submittedBy.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
        if (emailMatch) {
          emailsToAdd.add(emailMatch[1] || emailMatch[0]);
        } else {
          const submittedByUser = users.find(user => user.name.toLowerCase() === saAssignment.submittedBy.toLowerCase());
          if (submittedByUser && submittedByUser.email) {
            emailsToAdd.add(submittedByUser.email);
          }
        }
      }

      // Add assigned SAs
      assignedSAs.forEach(saWithEmail => {
        // Extract email from "Name <email>" format or use name lookup
        const emailMatch = saWithEmail.match(/<([^>]+)>/);
        if (emailMatch) {
          emailsToAdd.add(emailMatch[1]);
        } else {
          const user = users.find(u => u.name.toLowerCase() === saWithEmail.toLowerCase());
          if (user && user.email) {
            emailsToAdd.add(user.email);
          }
        }
      });

      // Add practice managers and principals
      for (const practice of assignedPractices) {
        const practiceLeaders = users.filter(user => 
          (user.role === 'practice_manager' || user.role === 'practice_principal') &&
          user.practices && user.practices.includes(practice)
        );
        
        practiceLeaders.forEach(user => {
          if (user.email) {
            emailsToAdd.add(user.email);
          }
        });
      }

      // Add each user to the space
      for (const email of emailsToAdd) {
        try {
          const addResponse = await fetch('https://webexapis.com/v1/memberships', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              roomId: spaceId,
              personEmail: email
            })
          });

          if (addResponse.ok) {
            logger.info('Added user to Webex space', { spaceId, email });
          } else {
            logger.warn('Failed to add user to Webex space', { 
              spaceId, 
              email, 
              status: addResponse.status 
            });
          }
        } catch (userError) {
          logger.error('Error adding user to space', { 
            spaceId, 
            email, 
            error: userError.message 
          });
        }
      }

      logger.info('Finished adding users to Webex space', { 
        spaceId, 
        totalUsers: emailsToAdd.size 
      });
    } catch (error) {
      logger.error('Error adding users to Webex space', { 
        spaceId, 
        error: error.message 
      });
    }
  }

  async sendBatchedStatusChangeNotification(spaceId, saAssignment, accessToken, statusChanges, practice = null) {
    try {
      if (!statusChanges || statusChanges.length === 0) return;
      
      const statusEmojis = {
        'In Progress': '🔄',
        'Pending Approval': '⏳',
        'Approved/Complete': '✅'
      };
      
      const practiceText = practice ? ` (${practice})` : '';
      const title = statusChanges.length === 1 ? 
        `👤 SA Status Updated${practiceText}` : 
        `👥 Multiple SA Status Updates${practiceText}`;
      
      const subtitle = statusChanges.length === 1 ?
        `${statusChanges[0].saName} status changed` :
        `${statusChanges.length} SAs updated their status`;
      
      // Build status change items for the card
      const statusChangeItems = statusChanges.map(change => ({
        type: "ColumnSet",
        columns: [
          {
            type: "Column",
            width: "auto",
            items: [{
              type: "TextBlock",
              text: change.saName,
              size: "Small",
              weight: "Bolder",
              color: "Accent"
            }]
          },
          {
            type: "Column",
            width: "stretch",
            items: [{
              type: "TextBlock",
              text: `${statusEmojis[change.oldStatus] || "📋"} ${change.oldStatus} → ${statusEmojis[change.newStatus] || "📋"} ${change.newStatus}`,
              size: "Small",
              horizontalAlignment: "Right",
              wrap: true
            }]
          }
        ]
      }));
      
      const adaptiveCard = {
        type: "AdaptiveCard",
        version: "1.2",
        body: [
          {
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
                        text: "📊",
                        size: "Large",
                        weight: "Bolder"
                      }
                    ]
                  },
                  {
                    type: "Column",
                    width: "stretch",
                    items: [
                      {
                        type: "TextBlock",
                        text: title,
                        size: "Large",
                        weight: "Bolder",
                        color: "Attention"
                      },
                      {
                        type: "TextBlock",
                        text: subtitle,
                        size: "Medium",
                        color: "Accent",
                        spacing: "None"
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            type: "Container",
            items: [
              {
                type: "FactSet",
                facts: [
                  {
                    title: "Opportunity",
                    value: `${saAssignment.opportunityId} • ${saAssignment.customerName}`
                  },
                  ...(practice ? [{
                    title: "Practice",
                    value: practice
                  }] : [])
                ]
              }
            ]
          },
          {
            type: "Container",
            items: [
              {
                type: "TextBlock",
                text: "Status Changes:",
                weight: "Bolder",
                size: "Medium"
              },
              ...statusChangeItems
            ]
          }
        ]
      };
      
      const messagePayload = {
        roomId: spaceId,
        text: `${title}: ${statusChanges.map(c => `${c.saName} (${c.oldStatus} → ${c.newStatus})`).join(', ')} for ${saAssignment.customerName}`,
        attachments: [{
          contentType: "application/vnd.microsoft.card.adaptive",
          content: adaptiveCard
        }]
      };
      
      const messageResponse = await fetch('https://webexapis.com/v1/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(messagePayload)
      });
      
      if (messageResponse.ok) {
        logger.info('Batched status change notification sent to Webex space', { 
          spaceId, 
          statusChanges: statusChanges.length
        });
      } else {
        logger.error('Failed to send batched status change notification', { 
          spaceId, 
          status: messageResponse.status 
        });
      }
    } catch (error) {
      logger.error('Error sending batched status change notification', { 
        spaceId, 
        error: error.message 
      });
    }
  }

  async sendStatusChangeNotification(spaceId, saAssignment, accessToken, changedBy, oldStatus, newStatus, isOverallStatus = false, practice = null) {
    try {
      const statusEmojis = {
        'In Progress': '🔄',
        'Pending Approval': '⏳',
        'Approved/Complete': '✅',
        'Pending': '📋',
        'Unassigned': '📁',
        'Assigned': '🎯',
        'Complete': '🏁'
      };
      
      const statusColors = {
        'In Progress': 'Warning',
        'Pending Approval': 'Attention',
        'Approved/Complete': 'Good',
        'Pending': 'Default',
        'Unassigned': 'Warning',
        'Assigned': 'Good',
        'Complete': 'Good'
      };
      
      const title = isOverallStatus ? 'SA Assignment Update' : 'Individual SA Update';
      const subtitle = isOverallStatus ? 'Overall status changed' : `${changedBy} updated their status`;
      
      const adaptiveCard = {
        type: "AdaptiveCard",
        version: "1.3",
        body: [
          {
            type: "Container",
            style: "emphasis",
            items: [
              {
                type: "ColumnSet",
                columns: [
                  {
                    type: "Column",
                    width: "auto",
                    verticalContentAlignment: "Center",
                    items: [
                      {
                        type: "TextBlock",
                        text: statusEmojis[newStatus] || "📋",
                        size: "ExtraLarge",
                        horizontalAlignment: "Center"
                      }
                    ]
                  },
                  {
                    type: "Column",
                    width: "stretch",
                    verticalContentAlignment: "Center",
                    items: [
                      {
                        type: "TextBlock",
                        text: title,
                        size: "Large",
                        weight: "Bolder",
                        color: statusColors[newStatus] || "Default",
                        wrap: true
                      },
                      {
                        type: "TextBlock",
                        text: subtitle,
                        size: "Medium",
                        color: "Accent",
                        spacing: "None",
                        wrap: true
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            type: "Container",
            spacing: "Medium",
            items: [
              {
                type: "ColumnSet",
                columns: [
                  {
                    type: "Column",
                    width: "stretch",
                    items: [
                      {
                        type: "TextBlock",
                        text: "📋 Opportunity",
                        size: "Small",
                        weight: "Bolder",
                        color: "Accent"
                      },
                      {
                        type: "TextBlock",
                        text: `${saAssignment.opportunityId || 'N/A'} • ${saAssignment.customerName}`,
                        size: "Small",
                        wrap: true,
                        spacing: "None"
                      }
                    ]
                  }
                ]
              },
              ...(practice ? [{
                type: "ColumnSet",
                spacing: "Small",
                columns: [
                  {
                    type: "Column",
                    width: "stretch",
                    items: [
                      {
                        type: "TextBlock",
                        text: "🎯 Practice",
                        size: "Small",
                        weight: "Bolder",
                        color: "Accent"
                      },
                      {
                        type: "TextBlock",
                        text: practice,
                        size: "Small",
                        spacing: "None"
                      }
                    ]
                  }
                ]
              }] : [])
            ]
          },
          {
            type: "Container",
            style: statusColors[newStatus] === 'Good' ? 'good' : statusColors[newStatus] === 'Warning' ? 'warning' : 'attention',
            spacing: "Medium",
            items: [
              {
                type: "ColumnSet",
                columns: [
                  {
                    type: "Column",
                    width: "auto",
                    verticalContentAlignment: "Center",
                    items: [
                      {
                        type: "TextBlock",
                        text: statusEmojis[oldStatus] || "📋",
                        size: "Medium",
                        horizontalAlignment: "Center"
                      }
                    ]
                  },
                  {
                    type: "Column",
                    width: "auto",
                    verticalContentAlignment: "Center",
                    items: [
                      {
                        type: "TextBlock",
                        text: "→",
                        size: "Large",
                        weight: "Bolder",
                        horizontalAlignment: "Center",
                        color: "Accent"
                      }
                    ]
                  },
                  {
                    type: "Column",
                    width: "auto",
                    verticalContentAlignment: "Center",
                    items: [
                      {
                        type: "TextBlock",
                        text: statusEmojis[newStatus] || "📋",
                        size: "Medium",
                        horizontalAlignment: "Center"
                      }
                    ]
                  },
                  {
                    type: "Column",
                    width: "stretch",
                    verticalContentAlignment: "Center",
                    items: [
                      {
                        type: "TextBlock",
                        text: `**${oldStatus}** → **${newStatus}**`,
                        size: "Medium",
                        weight: "Bolder",
                        wrap: true
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      };
      
      const messagePayload = {
        roomId: spaceId,
        text: `${title}: ${oldStatus} → ${newStatus} for ${saAssignment.customerName}`,
        attachments: [{
          contentType: "application/vnd.microsoft.card.adaptive",
          content: adaptiveCard
        }]
      };
      
      const messageResponse = await fetch('https://webexapis.com/v1/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(messagePayload)
      });
      
      if (messageResponse.ok) {
        logger.info('Status change notification sent to Webex space', { 
          spaceId, 
          changedBy, 
          oldStatus, 
          newStatus, 
          isOverallStatus 
        });
      } else {
        logger.error('Failed to send status change notification', { 
          spaceId, 
          status: messageResponse.status 
        });
      }
    } catch (error) {
      logger.error('Error sending status change notification', { 
        spaceId, 
        error: error.message 
      });
    }
  }

  async sendSAAssignmentCompletionNotification(spaceId, saAssignment, accessToken) {
    try {
      const users = await db.getAllUsers();
      const saCompletions = JSON.parse(saAssignment.saCompletions || '{}');
      const practiceList = saAssignment.practice ? saAssignment.practice.split(',').map(p => p.trim()) : [];
      
      // Get all completed SAs by practice
      const practiceCompletions = {};
      Object.entries(saCompletions).forEach(([key, completion]) => {
        if (key.includes('::')) {
          const [saName, practice] = key.split('::');
          const friendlyName = saName.replace(/<[^>]+>/g, '').trim();
          if (!practiceCompletions[practice]) practiceCompletions[practice] = [];
          practiceCompletions[practice].push({
            name: friendlyName,
            status: completion.status || 'Complete',
            completedAt: completion.completedAt
          });
        }
      });
      
      // Build practice completion items for the card
      const practiceItems = Object.entries(practiceCompletions).map(([practice, sas]) => ({
        type: "ColumnSet",
        columns: [
          {
            type: "Column",
            width: "auto",
            items: [{
              type: "TextBlock",
              text: "✅",
              size: "Medium",
              horizontalAlignment: "Center"
            }]
          },
          {
            type: "Column",
            width: "stretch",
            items: [
              {
                type: "TextBlock",
                text: practice,
                size: "Medium",
                weight: "Bolder",
                color: "Good"
              },
              {
                type: "TextBlock",
                text: sas.map(sa => sa.name).join(', '),
                size: "Small",
                color: "Accent",
                wrap: true,
                spacing: "None"
              }
            ]
          }
        ]
      }));
      
      const adaptiveCard = {
        type: "AdaptiveCard",
        version: "1.3",
        body: [
          {
            type: "Container",
            style: "good",
            items: [
              {
                type: "ColumnSet",
                columns: [
                  {
                    type: "Column",
                    width: "auto",
                    verticalContentAlignment: "Center",
                    items: [
                      {
                        type: "TextBlock",
                        text: "🎉",
                        size: "ExtraLarge",
                        horizontalAlignment: "Center"
                      }
                    ]
                  },
                  {
                    type: "Column",
                    width: "stretch",
                    verticalContentAlignment: "Center",
                    items: [
                      {
                        type: "TextBlock",
                        text: "SA Assignment Complete!",
                        size: "ExtraLarge",
                        weight: "Bolder",
                        color: "Good"
                      },
                      {
                        type: "TextBlock",
                        text: "Ready to send to customer",
                        size: "Large",
                        color: "Accent",
                        spacing: "None"
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            type: "Container",
            spacing: "Medium",
            items: [
              {
                type: "FactSet",
                facts: [
                  {
                    title: "🎯 Opportunity",
                    value: `${saAssignment.opportunityId} • ${saAssignment.customerName}`
                  },
                  {
                    title: "📋 Description",
                    value: saAssignment.opportunityName || 'N/A'
                  },
                  {
                    title: "👥 Practices",
                    value: practiceList.join(', ')
                  },
                  {
                    title: "📅 Completed",
                    value: new Date().toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  }
                ]
              }
            ]
          },
          {
            type: "Container",
            style: "emphasis",
            spacing: "Medium",
            items: [
              {
                type: "TextBlock",
                text: "✅ Completed SA Resources by Practice",
                size: "Large",
                weight: "Bolder",
                color: "Good"
              },
              ...practiceItems
            ]
          },
          {
            type: "Container",
            style: "attention",
            spacing: "Medium",
            items: [
              {
                type: "TextBlock",
                text: "🚀 Next Steps",
                size: "Medium",
                weight: "Bolder",
                color: "Attention"
              },
              {
                type: "TextBlock",
                text: "• The Technical Editing team will engage to make the documents customer ready\n• Once the Technical Editing team is complete, you may access your completed and edited SoW and Quote to send to your customer",
                wrap: true,
                size: "Small",
                spacing: "Small"
              }
            ]
          }
        ],
        actions: [
          {
            type: "Action.OpenUrl",
            title: "🔗 View SCOOP Opportunity",
            url: saAssignment.scoopUrl || `https://scoop.netsync.com/opportunity/index?no=${saAssignment.opportunityId}`
          }
        ]
      };
      
      const messagePayload = {
        roomId: spaceId,
        text: `🎉 SA Assignment Complete! Opportunity ${saAssignment.opportunityId} for ${saAssignment.customerName} is ready to send to customer. View SCOOP: ${saAssignment.scoopUrl || `https://scoop.netsync.com/opportunity/index?no=${saAssignment.opportunityId}`}`,
        attachments: [{
          contentType: "application/vnd.microsoft.card.adaptive",
          content: adaptiveCard
        }]
      };
      
      const messageResponse = await fetch('https://webexapis.com/v1/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(messagePayload)
      });
      
      if (messageResponse.ok) {
        logger.info('SA assignment completion notification sent to Webex space', { spaceId });
      } else {
        logger.error('Failed to send SA assignment completion notification', { 
          spaceId, 
          status: messageResponse.status 
        });
      }
    } catch (error) {
      logger.error('Error sending SA assignment completion notification', { 
        spaceId, 
        error: error.message 
      });
    }
  }

  async sendSACompletionUpdate(spaceId, saAssignment, accessToken, completedSA) {
    try {
      const users = await db.getAllUsers();
      const saCompletions = JSON.parse(saAssignment.saCompletions || '{}');
      const practiceList = saAssignment.practice ? saAssignment.practice.split(',').map(p => p.trim()) : [];
      // Extract SAs from new practiceAssignments structure
      let saList = [];
      if (saAssignment.practiceAssignments) {
        try {
          const practiceAssignments = JSON.parse(saAssignment.practiceAssignments);
          const allSAs = new Set();
          Object.values(practiceAssignments).forEach(saArray => {
            if (Array.isArray(saArray)) {
              saArray.forEach(sa => allSAs.add(sa));
            }
          });
          saList = Array.from(allSAs);
        } catch (e) {
          logger.error('Error parsing practiceAssignments', { error: e.message });
        }
      }
      // Fallback to legacy saAssigned field
      if (saList.length === 0 && saAssignment.saAssigned) {
        saList = saAssignment.saAssigned.split(',').map(s => s.trim());
      }
      
      // Build practice-SA status display
      const practiceStatusItems = [];
      practiceList.forEach(practice => {
        const assignedSAs = saList.filter(saName => {
          const user = users.find(u => u.name === saName);
          return user && user.practices && user.practices.includes(practice);
        });
        
        const practiceComplete = assignedSAs.length > 0 && assignedSAs.every(sa => saCompletions[sa]);
        
        assignedSAs.forEach(sa => {
          const saComplete = !!saCompletions[sa];
          const saDisplayName = sa.replace(/<[^>]+>/g, '').trim();
          practiceStatusItems.push({
            type: "ColumnSet",
            columns: [
              {
                type: "Column",
                width: "auto",
                items: [{
                  type: "TextBlock",
                  text: practice,
                  size: "Small",
                  weight: "Bolder",
                  color: practiceComplete ? "Good" : "Warning"
                }]
              },
              {
                type: "Column",
                width: "stretch",
                items: [{
                  type: "TextBlock",
                  text: "→",
                  size: "Small",
                  horizontalAlignment: "Center"
                }]
              },
              {
                type: "Column",
                width: "auto",
                items: [{
                  type: "TextBlock",
                  text: saDisplayName,
                  size: "Small",
                  weight: "Bolder",
                  color: saComplete ? "Good" : "Warning"
                }]
              },
              {
                type: "Column",
                width: "auto",
                items: [{
                  type: "TextBlock",
                  text: saComplete ? "✅ Complete" : "🔄 In Progress",
                  size: "Small",
                  horizontalAlignment: "Right"
                }]
              }
            ]
          });
        });
      });
      
      const isFullyComplete = saAssignment.status === 'Complete';
      const title = isFullyComplete ? "🎉 SA Assignment Fully Complete!" : `📋 SA Progress Update - ${completedSA} Completed`;
      
      const adaptiveCard = {
        type: "AdaptiveCard",
        version: "1.2",
        body: [
          {
            type: "Container",
            style: isFullyComplete ? "good" : "emphasis",
            items: [{
              type: "TextBlock",
              text: title,
              size: "Large",
              weight: "Bolder",
              color: isFullyComplete ? "Good" : "Default"
            }]
          },
          {
            type: "Container",
            items: [
              {
                type: "TextBlock",
                text: "Practice & SA Status:",
                weight: "Bolder",
                size: "Medium"
              },
              ...practiceStatusItems
            ]
          }
        ]
      };
      
      const messagePayload = {
        roomId: spaceId,
        text: `${title} for ${saAssignment.customerName}`,
        attachments: [{
          contentType: "application/vnd.microsoft.card.adaptive",
          content: adaptiveCard
        }]
      };
      
      const messageResponse = await fetch('https://webexapis.com/v1/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(messagePayload)
      });
      
      if (messageResponse.ok) {
        logger.info('SA completion update sent to Webex space', { spaceId, completedSA });
      } else {
        logger.error('Failed to send SA completion update', { spaceId, status: messageResponse.status });
      }
    } catch (error) {
      logger.error('Error sending SA completion update', { spaceId, error: error.message });
    }
  }

  async sendWelcomeMessage(spaceId, saAssignment, accessToken) {
    try {
      logger.info('Sending welcome message to Webex space', { spaceId, saAssignmentId: saAssignment.id });
      
      const assignedPractices = saAssignment.practice ? saAssignment.practice.split(',').map(p => p.trim()) : [];
      // Extract SAs from new practiceAssignments structure
      let assignedSAs = [];
      let practiceAssignments = {};
      if (saAssignment.practiceAssignments) {
        try {
          practiceAssignments = JSON.parse(saAssignment.practiceAssignments);
          const allSAs = new Set();
          Object.values(practiceAssignments).forEach(saList => {
            if (Array.isArray(saList)) {
              saList.forEach(sa => allSAs.add(sa));
            }
          });
          assignedSAs = Array.from(allSAs).map(sa => sa.replace(/<[^>]+>/g, '').trim());
        } catch (e) {
          logger.error('Error parsing practiceAssignments', { error: e.message });
        }
      }
      // Fallback to legacy saAssigned field
      if (assignedSAs.length === 0 && saAssignment.saAssigned) {
        assignedSAs = saAssignment.saAssigned.split(',').map(r => r.trim());
      }
      
      // Build practice-specific SA assignment display for adaptive card
      const practiceAssignmentItems = [];
      if (Object.keys(practiceAssignments).length > 0) {
        Object.entries(practiceAssignments).forEach(([practice, saList]) => {
          if (Array.isArray(saList) && saList.length > 0) {
            const friendlyNames = saList.map(sa => sa.replace(/<[^>]+>/g, '').trim());
            practiceAssignmentItems.push({
              type: "ColumnSet",
              columns: [
                {
                  type: "Column",
                  width: "auto",
                  items: [{
                    type: "TextBlock",
                    text: practice,
                    size: "Small",
                    weight: "Bolder",
                    color: "Accent"
                  }]
                },
                {
                  type: "Column",
                  width: "auto",
                  items: [{
                    type: "TextBlock",
                    text: "→",
                    size: "Small",
                    horizontalAlignment: "Center"
                  }]
                },
                {
                  type: "Column",
                  width: "stretch",
                  items: [{
                    type: "TextBlock",
                    text: friendlyNames.join(', '),
                    size: "Small",
                    weight: "Bolder",
                    color: "Good",
                    wrap: true
                  }]
                }
              ]
            });
          }
        });
      }
      
      const env = process.env.ENVIRONMENT || 'dev';
      const ssmPrefix = env === 'prod' ? '/PracticeTools' : `/PracticeTools/${env}`;
      const baseUrl = await getSecureParameter(`${ssmPrefix}/NEXTAUTH_URL`) || process.env.NEXTAUTH_URL || 'http://localhost:3000';
      
      const adaptiveCard = {
        type: "AdaptiveCard",
        version: "1.2",
        body: [
          {
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
                        text: "🎉",
                        size: "Large",
                        weight: "Bolder"
                      }
                    ]
                  },
                  {
                    type: "Column",
                    width: "stretch",
                    items: [
                      {
                        type: "TextBlock",
                        text: "SA Resources Assigned Successfully",
                        size: "Large",
                        weight: "Bolder",
                        color: "Good"
                      },
                      {
                        type: "TextBlock",
                        text: `SCOOP Opportunity • ${saAssignment.customerName}`,
                        size: "Medium",
                        color: "Accent",
                        spacing: "None"
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            type: "Container",
            items: [
              {
                type: "FactSet",
                facts: [
                  {
                    title: "Opportunity #",
                    value: saAssignment.opportunityId || 'N/A'
                  },
                  {
                    title: "Customer",
                    value: saAssignment.customerName || 'N/A'
                  },
                  {
                    title: "Practice",
                    value: assignedPractices.join(', ') || 'N/A'
                  },
                  {
                    title: "SA Resources",
                    value: assignedSAs.join(', ') || 'N/A'
                  }
                ]
              }
            ]
          },
          ...(practiceAssignmentItems.length > 0 ? [{
            type: "Container",
            style: "emphasis",
            items: [
              {
                type: "TextBlock",
                text: "🎯 Practice-Specific SA Assignments",
                weight: "Bolder",
                size: "Medium",
                color: "Accent"
              },
              ...practiceAssignmentItems
            ]
          }] : []),
          {
            type: "Container",
            items: [
              {
                type: "TextBlock",
                text: "Opportunity Description",
                weight: "Bolder",
                size: "Medium"
              },
              {
                type: "TextBlock",
                text: saAssignment.opportunityName || 'No description provided',
                wrap: true,
                spacing: "Small"
              }
            ]
          },
          {
            type: "Container",
            style: "good",
            items: [
              {
                type: "TextBlock",
                text: "🎯 Welcome to your SCOOP collaboration space! This space has been created to facilitate communication and coordination for this SA assignment. All stakeholders have been added to ensure seamless collaboration on this opportunity.",
                wrap: true,
                size: "Small"
              }
            ]
          }
        ],
        actions: [
          {
            type: "Action.OpenUrl",
            title: "View SA Assignment",
            url: `${baseUrl}/projects/sa-assignments/${saAssignment.id}`
          }
        ]
      };

      const messagePayload = {
        roomId: spaceId,
        text: `🎉 **SA Resources Assigned Successfully**\\n\\nSCOOP opportunity for ${saAssignment.customerName} has been assigned to ${assignedSAs.map(sa => sa.replace(/<[^>]+>/g, '').trim()).join(', ')}.`,
        attachments: [
          {
            contentType: "application/vnd.microsoft.card.adaptive",
            content: adaptiveCard
          }
        ]
      };

      const messageResponse = await fetch('https://webexapis.com/v1/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(messagePayload)
      });

      if (messageResponse.ok) {
        logger.info('Welcome message sent successfully to Webex space', { spaceId });
      } else {
        const errorText = await messageResponse.text();
        logger.error('Failed to send welcome message to Webex space', { 
          spaceId, 
          status: messageResponse.status,
          error: errorText
        });
      }
    } catch (error) {
      logger.error('Error sending welcome message to Webex space', { 
        spaceId, 
        saAssignmentId: saAssignment.id,
        error: error.message,
        stack: error.stack
      });
    }
  }

  async updateSAAssignmentWithSpaceId(saAssignmentId, spaceId) {
    try {
      await db.updateSAAssignment(saAssignmentId, { webex_space_id: spaceId });
      logger.info('Updated SA assignment with Webex space ID', { saAssignmentId, spaceId });
    } catch (error) {
      logger.error('Error updating SA assignment with space ID', { 
        saAssignmentId, 
        spaceId, 
        error: error.message 
      });
    }
  }

  async removeAllUsersFromSpace(saAssignment) {
    try {
      if (!saAssignment.webex_space_id) {
        logger.info('No Webex space ID found for SA assignment', { saAssignmentId: saAssignment.id });
        return;
      }

      const assignedPractices = saAssignment.practice ? saAssignment.practice.split(',').map(p => p.trim()).sort() : [];
      if (assignedPractices.length === 0) {
        logger.warn('No practices found for space cleanup', { saAssignmentId: saAssignment.id });
        return;
      }

      const primaryPractice = assignedPractices[0];
      const webexBot = await db.getPracticeWebexBot(primaryPractice);
      
      if (!webexBot || !webexBot.accessToken) {
        logger.warn('No Webex bot found for space cleanup', { 
          saAssignmentId: saAssignment.id, 
          primaryPractice: primaryPractice 
        });
        return;
      }

      // Get all memberships in the space
      const membershipsResponse = await fetch(`https://webexapis.com/v1/memberships?roomId=${saAssignment.webex_space_id}`, {
        headers: {
          'Authorization': `Bearer ${webexBot.accessToken}`
        }
      });

      if (!membershipsResponse.ok) {
        logger.error('Failed to get space memberships', { 
          saAssignmentId: saAssignment.id,
          spaceId: saAssignment.webex_space_id,
          status: membershipsResponse.status
        });
        return;
      }

      const memberships = await membershipsResponse.json();
      
      // Remove all members except the bot itself
      for (const membership of memberships.items) {
        if (membership.personEmail !== webexBot.email) {
          try {
            const removeResponse = await fetch(`https://webexapis.com/v1/memberships/${membership.id}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${webexBot.accessToken}`
              }
            });

            if (removeResponse.ok) {
              logger.info('Removed user from Webex space', { 
                spaceId: saAssignment.webex_space_id, 
                email: membership.personEmail 
              });
            }
          } catch (removeError) {
            logger.error('Error removing user from space', { 
              spaceId: saAssignment.webex_space_id, 
              email: membership.personEmail,
              error: removeError.message 
            });
          }
        }
      }

      logger.info('Completed Webex space cleanup', { 
        saAssignmentId: saAssignment.id,
        spaceId: saAssignment.webex_space_id
      });
    } catch (error) {
      logger.error('Error removing users from Webex space', { 
        saAssignmentId: saAssignment.id,
        error: error.message,
        stack: error.stack
      });
    }
  }
}

export const saWebexService = new SAWebexService();