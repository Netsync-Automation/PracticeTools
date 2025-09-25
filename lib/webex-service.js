import { db } from './dynamodb.js';
import { logger } from './safe-logger.js';

class WebexService {
  async createProjectSpace(assignment) {
    try {
      logger.info('Creating Webex space for assignment', { assignmentId: assignment.id });

      const assignedPractices = assignment.practice ? assignment.practice.split(',').map(p => p.trim()).sort() : [];
      if (assignedPractices.length === 0) {
        logger.warn('No practices assigned, cannot create Webex space', { assignmentId: assignment.id });
        return null;
      }

      // Get the first practice alphabetically to determine which bot to use
      const primaryPractice = assignedPractices[0];
      const webexBot = await db.getPracticeWebexBot(primaryPractice);
      
      if (!webexBot || !webexBot.accessToken) {
        logger.warn('No Webex bot found for primary practice', { 
          assignmentId: assignment.id, 
          primaryPractice: primaryPractice 
        });
        return null;
      }

      // Create space name: (Internal) ProjectNumber-ClientName-ProjectDescription
      const spaceName = `(Internal) ${assignment.projectNumber}-${assignment.customerName}-${assignment.projectDescription}`.substring(0, 200);

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
          assignmentId: assignment.id,
          status: spaceResponse.status,
          error: errorText
        });
        return null;
      }

      const space = await spaceResponse.json();
      logger.info('Webex space created successfully', { 
        assignmentId: assignment.id,
        spaceId: space.id,
        spaceName: spaceName
      });

      // Add users to the space
      await this.addUsersToSpace(space.id, assignment, webexBot.accessToken);

      // Send welcome message with assignment details
      await this.sendWelcomeMessage(space.id, assignment, webexBot.accessToken);

      // Store space ID in assignment for future reference
      await this.updateAssignmentWithSpaceId(assignment.id, space.id);

      return space.id;
    } catch (error) {
      logger.error('Error creating Webex space', { 
        assignmentId: assignment.id,
        error: error.message,
        stack: error.stack
      });
      return null;
    }
  }

  async addUsersToSpace(spaceId, assignment, accessToken) {
    try {
      // DSR: Ensure all email fields are populated (backwards compatibility)
      const { AssignmentEmailProcessor } = await import('./assignment-email-processor.js');
      assignment = await AssignmentEmailProcessor.processAssignmentEmails(assignment);
      
      const users = await db.getAllUsers();
      const assignedPractices = assignment.practice ? assignment.practice.split(',').map(p => p.trim()) : [];
      const assignedResources = assignment.resourceAssigned ? assignment.resourceAssigned.split(',').map(r => r.trim()) : [];
      const emailsToAdd = new Set();

      // Add Account Manager email if available (DSR compliance)
      if (assignment.am_email) {
        emailsToAdd.add(assignment.am_email);
      }
      
      // Add PM email if available
      if (assignment.pm_email) {
        emailsToAdd.add(assignment.pm_email);
      }
      
      // Add Resource Assigned email if available (DSR compliance)
      if (assignment.resource_assigned_email) {
        emailsToAdd.add(assignment.resource_assigned_email);
      }
      
      // Add notification users (DSR compliance)
      const notificationUsers = JSON.parse(assignment.resource_assignment_notification_users || '[]');
      notificationUsers.forEach(user => {
        if (user.email) {
          emailsToAdd.add(user.email);
        }
      });

      // Add assigned resources
      assignedResources.forEach(resourceName => {
        const user = users.find(u => u.name.toLowerCase() === resourceName.toLowerCase());
        if (user && user.email) {
          emailsToAdd.add(user.email);
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

  async sendWelcomeMessage(spaceId, assignment, accessToken) {
    try {
      logger.info('Sending welcome message to Webex space', { spaceId, assignmentId: assignment.id });
      
      const assignedPractices = assignment.practice ? assignment.practice.split(',').map(p => p.trim()) : [];
      const assignedResources = assignment.resourceAssigned ? assignment.resourceAssigned.split(',').map(r => r.trim()) : [];
      
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
                        text: "🚀",
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
                        text: "Resources Assigned Successfully",
                        size: "Large",
                        weight: "Bolder",
                        color: "Good"
                      },
                      {
                        type: "TextBlock",
                        text: `Assignment #${assignment.assignment_number} • ${assignment.customerName}`,
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
                    title: "Project #",
                    value: assignment.projectNumber || 'N/A'
                  },
                  {
                    title: "Customer",
                    value: assignment.customerName || 'N/A'
                  },
                  {
                    title: "Practice",
                    value: assignedPractices.join(', ') || 'N/A'
                  },
                  {
                    title: "Resources",
                    value: assignedResources.join(', ') || 'N/A'
                  },
                  {
                    title: "Date Assigned",
                    value: assignment.dateAssigned ? new Date(assignment.dateAssigned).toLocaleDateString() : 'N/A'
                  }
                ]
              }
            ]
          },
          {
            type: "Container",
            items: [
              {
                type: "TextBlock",
                text: "Project Description",
                weight: "Bolder",
                size: "Medium"
              },
              {
                type: "TextBlock",
                text: assignment.projectDescription || 'No description provided',
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
                text: "🎯 Welcome to your project collaboration space! This space has been created to facilitate communication and coordination for this resource assignment. All project stakeholders have been added to ensure seamless collaboration.",
                wrap: true,
                size: "Small"
              }
            ]
          }
        ],
        actions: [
          {
            type: "Action.OpenUrl",
            title: "View in Practice Tools",
            url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/projects/resource-assignments/${assignment.id}`
          }
        ]
      };

      logger.info('Adaptive card prepared', { 
        spaceId, 
        cardVersion: adaptiveCard.version,
        bodyItems: adaptiveCard.body.length,
        actions: adaptiveCard.actions.length
      });

      const messagePayload = {
        roomId: spaceId,
        text: `🚀 **Resources Assigned Successfully**\n\nAssignment #${assignment.assignment_number} for ${assignment.customerName} has been assigned to ${assignedResources.join(', ')}.`,
        attachments: [
          {
            contentType: "application/vnd.microsoft.card.adaptive",
            content: adaptiveCard
          }
        ]
      };

      logger.info('Sending message to Webex API', { 
        spaceId,
        payloadSize: JSON.stringify(messagePayload).length
      });

      const messageResponse = await fetch('https://webexapis.com/v1/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(messagePayload)
      });

      const responseText = await messageResponse.text();
      
      if (messageResponse.ok) {
        logger.info('Welcome message sent successfully to Webex space', { 
          spaceId,
          status: messageResponse.status,
          response: responseText.substring(0, 200)
        });
      } else {
        logger.error('Failed to send welcome message to Webex space', { 
          spaceId, 
          status: messageResponse.status,
          statusText: messageResponse.statusText,
          response: responseText
        });
      }
    } catch (error) {
      logger.error('Error sending welcome message to Webex space', { 
        spaceId, 
        assignmentId: assignment.id,
        error: error.message,
        stack: error.stack
      });
    }
  }

  async updateAssignmentWithSpaceId(assignmentId, spaceId) {
    try {
      await db.updateAssignment(assignmentId, { webex_space_id: spaceId });
      logger.info('Updated assignment with Webex space ID', { assignmentId, spaceId });
    } catch (error) {
      logger.error('Error updating assignment with space ID', { 
        assignmentId, 
        spaceId, 
        error: error.message 
      });
    }
  }

  async removeAllUsersFromSpace(assignment) {
    try {
      if (!assignment.webex_space_id) {
        logger.info('No Webex space ID found for assignment', { assignmentId: assignment.id });
        return;
      }

      const assignedPractices = assignment.practice ? assignment.practice.split(',').map(p => p.trim()).sort() : [];
      if (assignedPractices.length === 0) {
        logger.warn('No practices found for space cleanup', { assignmentId: assignment.id });
        return;
      }

      const primaryPractice = assignedPractices[0];
      const webexBot = await db.getPracticeWebexBot(primaryPractice);
      
      if (!webexBot || !webexBot.accessToken) {
        logger.warn('No Webex bot found for space cleanup', { 
          assignmentId: assignment.id, 
          primaryPractice: primaryPractice 
        });
        return;
      }

      // Get all memberships in the space
      const membershipsResponse = await fetch(`https://webexapis.com/v1/memberships?roomId=${assignment.webex_space_id}`, {
        headers: {
          'Authorization': `Bearer ${webexBot.accessToken}`
        }
      });

      if (!membershipsResponse.ok) {
        logger.error('Failed to get space memberships', { 
          assignmentId: assignment.id,
          spaceId: assignment.webex_space_id,
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
                spaceId: assignment.webex_space_id, 
                email: membership.personEmail 
              });
            }
          } catch (removeError) {
            logger.error('Error removing user from space', { 
              spaceId: assignment.webex_space_id, 
              email: membership.personEmail,
              error: removeError.message 
            });
          }
        }
      }

      logger.info('Completed Webex space cleanup', { 
        assignmentId: assignment.id,
        spaceId: assignment.webex_space_id
      });
    } catch (error) {
      logger.error('Error removing users from Webex space', { 
        assignmentId: assignment.id,
        error: error.message,
        stack: error.stack
      });
    }
  }
}

export const webexService = new WebexService();