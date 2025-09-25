import { getEWSClient } from './ews-client.js';
import { db } from './dynamodb.js';
import { logger } from './safe-logger.js';
import { extractAndMatchPractice } from './practice-extractor.js';
import { saAutoAssignment } from './sa-auto-assignment.js';
import { saEmailService } from './sa-email-service.js';
import { getSecureParameter } from './ssm-config.js';

export class EmailProcessor {
  constructor() {
    this.isProcessing = false;
    this.lastProcessTime = null;
  }

  async processResourceEmails() {
    if (this.isProcessing) {
      logger.info('Email processing already in progress, skipping');
      return;
    }

    try {
      this.isProcessing = true;
      logger.info('Starting resource email processing');

      // Check if email notifications are enabled first
      const emailEnabled = await db.getSetting('emailNotifications') === 'true';
      if (!emailEnabled) {
        logger.info('Email notifications are disabled - resource processing unavailable');
        return;
      }
      
      // Check if resource email processing is enabled
      const resourceEnabled = await db.getSetting('resourceEmailEnabled') === 'true';
      if (!resourceEnabled) {
        logger.info('Resource email processing is disabled');
        return;
      }

      // Get processing rules from DynamoDB
      const rules = await db.getEmailRules();
      const enabledRules = rules.filter(rule => rule.enabled !== false);
      
      if (enabledRules.length === 0) {
        logger.info('No enabled resource email rules configured');
        return;
      }

      logger.info('Processing emails with rules', { ruleCount: enabledRules.length });

      // Get EWS client and check for new emails
      const ewsClient = getEWSClient();
      const emails = await ewsClient.checkNewMail(this.lastProcessTime);

      logger.info('Found emails to process', { emailCount: emails.length });

      for (const email of emails) {
        await this.processEmail(email, enabledRules);
      }

      this.lastProcessTime = new Date();
      logger.info('Email processing completed successfully');

    } catch (error) {
      logger.error('Email processing failed', { error: error.message });
    } finally {
      this.isProcessing = false;
    }
  }

  async processEmail(email, rules) {
    try {
      logger.info('Processing email', { 
        subject: email.subject, 
        from: email.from,
        id: email.id 
      });

      // Find matching rule
      const matchingRule = rules.find(rule => 
        this.matchesRule(email, rule)
      );

      if (!matchingRule) {
        logger.info('No matching rule found for email', { 
          subject: email.subject, 
          from: email.from 
        });
        return;
      }

      logger.info('Found matching rule', { 
        senderEmail: matchingRule.senderEmail,
        subjectPattern: matchingRule.subjectPattern,
        action: matchingRule.action || 'resource_assignment'
      });

      // Execute the specified action
      const actionResult = await this.executeAction(email, matchingRule);
      
      if (actionResult.success) {
        logger.info('Action executed successfully', { 
          action: matchingRule.action || 'resource_assignment',
          result: actionResult.result
        });
        
        // Mark email as read after successful processing
        try {
          const ewsClient = getEWSClient();
          await ewsClient.markAsRead(email.id);
          logger.info('Email marked as read after successful processing', { emailId: email.id });
        } catch (markError) {
          logger.error('Failed to mark email as read', { 
            error: markError.message,
            emailId: email.id 
          });
        }
      } else {
        logger.error('Action execution failed - email left unread for retry', { 
          emailId: email.id,
          error: actionResult.error
        });
      }

    } catch (error) {
      logger.error('Error processing individual email', { 
        error: error.message,
        emailId: email.id 
      });
    }
  }

  async executeAction(email, rule) {
    const action = rule.action || 'resource_assignment';
    
    try {
      switch (action) {
        case 'resource_assignment':
          return await this.executeResourceAssignmentAction(email, rule);
        case 'sa_assignment':
          return await this.executeSaAssignmentAction(email, rule);
        case 'sa_assignment_approval_request':
          return await this.executeSaAssignmentApprovalRequestAction(email, rule);
        case 'sa_assignment_approved':
          return await this.executeSaAssignmentApprovedAction(email, rule);
        default:
          logger.error('Unknown action type', { action });
          return { success: false, error: `Unknown action: ${action}` };
      }
    } catch (error) {
      logger.error('Action execution error', { action, error: error.message });
      return { success: false, error: error.message };
    }
  }

  async executeResourceAssignmentAction(email, rule) {
    try {
      // Log full email body to see forwarded content
      logger.info('Full email body for debugging', {
        fullEmailBody: email.body,
        bodyLength: email.body.length
      });
      
      // Extract data from email using keyword mappings
      const extractedData = await this.extractDataFromEmail(email, rule.keywordMappings);
      
      // Populate missing keywords with "Not Found"
      rule.keywordMappings.forEach(mapping => {
        if (!extractedData[mapping.field]) {
          extractedData[mapping.field] = 'Not Found';
          logger.info('Keyword not found, setting to default', {
            keyword: mapping.keyword,
            field: mapping.field,
            value: 'Not Found'
          });
        }
      });
      
      const missingCount = rule.keywordMappings.filter(m => extractedData[m.field] === 'Not Found').length;
      if (missingCount > 0) {
        logger.warn('Some keywords not found in email, using default values', { 
          emailId: email.id,
          total: rule.keywordMappings.length,
          missing: missingCount,
          missingKeywords: rule.keywordMappings.filter(m => extractedData[m.field] === 'Not Found').map(m => m.keyword)
        });
      }

      // Create resource assignment using database-stored field mappings
      const resourceAssignment = {};
      
      // Get field mappings from database
      let fieldMappings = [];
      try {
        const response = await fetch('/api/email-field-mappings');
        if (response.ok) {
          const data = await response.json();
          fieldMappings = data.mappings || [];
        }
      } catch (error) {
        logger.error('Failed to fetch field mappings, using fallback', { error: error.message });
        // Fallback to hardcoded mappings if API fails
        fieldMappings = [
          { value: 'projectNumber', label: 'Project Number' },
          { value: 'clientName', label: 'Client Name' },
          { value: 'requestedBy', label: 'Requested By' },
          { value: 'skillsRequired', label: 'Skills Required' },
          { value: 'startDate', label: 'Start Date' },
          { value: 'endDate', label: 'End Date' },
          { value: 'description', label: 'Description' },
          { value: 'priority', label: 'Priority' },
          { value: 'region', label: 'Region' },
          { value: 'pm', label: 'PM' },
          { value: 'documentationLink', label: 'Documentation Link' },
          { value: 'notes', label: 'Notes' },
          { value: 'resource_assignment_notification_users', label: 'Notification Users' }
        ];
      }
      
      // Map extracted data using database-stored field mappings
      fieldMappings.forEach(field => {
        resourceAssignment[field.value] = extractedData[field.value] || '';
      });
      
      // Set defaults and fallbacks
      resourceAssignment.requestedBy = resourceAssignment.requestedBy || email.from;
      resourceAssignment.description = resourceAssignment.description || email.subject;
      resourceAssignment.priority = resourceAssignment.priority || 'Medium';
      resourceAssignment.skillsRequired = resourceAssignment.skillsRequired ? [resourceAssignment.skillsRequired] : [];
      
      // Add fixed fields
      resourceAssignment.status = 'Open';
      resourceAssignment.source = 'Email';
      resourceAssignment.emailId = email.id;

      logger.info('Creating resource assignment from email', { 
        projectNumber: resourceAssignment.projectNumber,
        clientName: resourceAssignment.clientName 
      });

      // DSR: Auto-populate practice managers and principals if no notification users
      let notificationUsers = extractedData.resourceAssignmentNotificationUsers || [];
      if (notificationUsers.length === 0) {
        try {
          const users = await db.getAllUsers();
          const practiceManagers = users.filter(user => 
            user.role === 'practice_manager' && user.practices && user.practices.length > 0
          );
          const practicePrincipals = users.filter(user => 
            user.role === 'practice_principal' && user.practices && user.practices.length > 0
          );
          
          notificationUsers = [...practiceManagers, ...practicePrincipals].map(user => ({
            name: user.name,
            email: user.email
          }));
          
          logger.info('DSR: Auto-populated notification users with practice managers and principals', {
            practiceManagerCount: practiceManagers.length,
            practicePrincipalCount: practicePrincipals.length,
            totalNotificationUsers: notificationUsers.length
          });
        } catch (error) {
          logger.error('Error auto-populating notification users', { error: error.message });
        }
      }
      
      logger.info('About to call db.addAssignment with parameters', {
        practice: 'Pending',
        status: 'Pending',
        projectNumber: extractedData.projectNumber || '',
        notificationUsers: notificationUsers
      });
      
      const assignmentId = await db.addAssignment(
        'Pending', // practice - set to Pending for email processing
        'Pending', // status
        extractedData.projectNumber || '', // projectNumber
        new Date().toISOString().split('T')[0], // requestDate
        extractedData.endDate || '', // eta
        extractedData.clientName || '', // customerName
        extractedData.description || email.subject, // projectDescription
        (extractedData.region || '').toUpperCase(), // region - convert to uppercase
        '', // am
        this.extractPMName(extractedData.pm || ''), // pm - extract and format name
        '', // resourceAssigned
        '', // dateAssigned
        extractedData.notes || '', // notes
        this.cleanDocumentationLink(extractedData.documentationLink || ''), // documentationLink - clean URL
        this.extractPMEmail(extractedData.pm || ''), // pm_email - extract email
        [], // attachments
        notificationUsers // DSR: notification users with auto-populated managers/principals
      );
      
      logger.info('db.addAssignment completed', { assignmentId });
      
      if (assignmentId) {
        logger.info('Resource assignment created successfully', { 
          assignmentId,
          emailId: email.id 
        });
        return { success: true, result: { assignmentId } };
      } else {
        return { success: false, error: 'Failed to create resource assignment' };
      }
      
    } catch (error) {
      logger.error('Error executing resource assignment action', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  async executeSaAssignmentApprovedAction(email, rule) {
    try {
      logger.info('Processing SA Assignment Approved email', {
        subject: email.subject,
        from: email.from,
        bodyLength: email.body.length
      });
      
      // Extract data from email using keyword mappings
      const extractedData = await this.extractDataFromEmail(email, rule.keywordMappings);
      
      // Populate missing keywords with "Not Found"
      rule.keywordMappings.forEach(mapping => {
        if (!extractedData[mapping.field]) {
          extractedData[mapping.field] = 'Not Found';
        }
      });
      
      const opportunityId = extractedData.opportunityId;
      const taskTriggeredBy = extractedData.taskTriggeredBy;
      const revisionNumber = extractedData.revisionNumber;
      
      logger.info('SA Assignment Approved extracted data', {
        opportunityId,
        taskTriggeredBy,
        revisionNumber
      });
      
      if (!opportunityId || opportunityId === 'Not Found') {
        return { success: false, error: 'Opportunity ID not found in email' };
      }
      
      if (!taskTriggeredBy || taskTriggeredBy === 'Not Found') {
        return { success: false, error: 'Task Triggered By not found in email' };
      }
      
      // Match Task Triggered By name to email in To: field
      let approverEmail = taskTriggeredBy;
      let approverName = taskTriggeredBy;
      
      if (extractedData.saAssignmentApprovedNotificationUsers && extractedData.saAssignmentApprovedNotificationUsers.length > 0) {
        const matchingUser = extractedData.saAssignmentApprovedNotificationUsers.find(user => 
          user.name.toLowerCase().includes(taskTriggeredBy.toLowerCase()) || 
          taskTriggeredBy.toLowerCase().includes(user.name.toLowerCase())
        );
        if (matchingUser) {
          approverEmail = matchingUser.email;
          approverName = matchingUser.name;
          logger.info('Matched Task Triggered By to email in To: field', {
            taskTriggeredBy,
            matchedName: approverName,
            matchedEmail: approverEmail
          });
        } else {
          logger.warn('Could not match Task Triggered By to any email in To: field', {
            taskTriggeredBy,
            availableUsers: extractedData.saAssignmentApprovedNotificationUsers
          });
        }
      }
      
      // Find SA assignment with matching opportunity ID
      const allSaAssignments = await db.getAllSaAssignments();
      const matchingAssignment = allSaAssignments.find(assignment => 
        assignment.opportunityId === opportunityId
      );
      
      if (!matchingAssignment) {
        return { success: false, error: `No SA assignment found for opportunity ID "${opportunityId}"` };
      }
      
      // Find approver user by email to get their practice associations
      const allUsers = await db.getAllUsers();
      const approverUser = allUsers.find(user => 
        user.email.toLowerCase() === approverEmail.toLowerCase()
      );
      
      if (!approverUser) {
        return { success: false, error: `Approver user not found: ${approverEmail} (${approverName})` };
      }
      
      if (!approverUser.practices || approverUser.practices.length === 0) {
        return { success: false, error: `Approver user has no practice associations: ${approverEmail} (${approverName})` };
      }
      
      logger.info('Found approver user with practices', {
        approverEmail: approverUser.email,
        approverName: approverUser.name,
        practices: approverUser.practices
      });
      
      // Get current SA completions
      const saCompletions = JSON.parse(matchingAssignment.saCompletions || '{}');
      let updatedAny = false;
      
      // Update SA statuses from "Pending Approval" to "Complete" for approver's practices
      for (const [completionKey, completion] of Object.entries(saCompletions)) {
        if (completion && completion.status === 'Pending Approval') {
          // Check if this completion is for one of the approver's practices
          const practiceMatch = approverUser.practices.some(practice => 
            completionKey.includes(`::${practice}`)
          );
          
          if (practiceMatch) {
            // Validate revision number if provided in email
            if (revisionNumber && revisionNumber !== 'Not Found') {
              if (!completion.revisionNumber) {
                logger.warn('SA completion has no revision number, skipping approval', {
                  completionKey,
                  emailRevision: revisionNumber,
                  saRevision: 'none'
                });
                continue;
              }
              
              if (completion.revisionNumber !== revisionNumber) {
                logger.warn('Revision number mismatch, skipping approval', {
                  completionKey,
                  emailRevision: revisionNumber,
                  saRevision: completion.revisionNumber
                });
                continue;
              }
            }
            
            saCompletions[completionKey] = {
              ...completion,
              status: 'Complete',
              completedAt: new Date().toISOString(),
              approvedBy: approverUser.email,
              revisionNumber: revisionNumber && revisionNumber !== 'Not Found' ? revisionNumber : completion.revisionNumber
            };
            updatedAny = true;
            
            logger.info('Updated SA status to Complete', {
              completionKey,
              approverEmail: approverUser.email,
              revisionNumber: saCompletions[completionKey].revisionNumber
            });
          }
        }
      }
      
      if (!updatedAny) {
        return { success: false, error: `No SAs in "Pending Approval" status found for approver's practices: ${approverUser.practices.join(', ')}` };
      }
      
      // Use API route to update SA assignment (centralizes status calculation and notifications)
      try {
        const env = process.env.ENVIRONMENT || 'dev';
        const ssmPrefix = env === 'prod' ? '/PracticeTools' : `/PracticeTools/${env}`;
        const baseUrl = process.env.NODE_ENV === 'development' ? 
          (process.env.NEXTAUTH_URL || 'http://localhost:3000') : 
          (await getSecureParameter(`${ssmPrefix}/NEXTAUTH_URL`) || process.env.NEXTAUTH_URL || 'http://localhost:3000');
        let adminApiKey = await getSecureParameter(`${ssmPrefix}/ADMIN_API_KEY`);
        if (!adminApiKey) {
          adminApiKey = process.env.ADMIN_API_KEY;
        }
        
        const response = await fetch(`${baseUrl}/api/sa-assignments/${matchingAssignment.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-service-auth': adminApiKey,
            'x-service-source': 'email-processor'
          },
          body: JSON.stringify({
            updateSAStatus: true,
            saCompletions: JSON.stringify(saCompletions)
          })
        });
        
        if (response.ok) {
          // Send batched Webex notification for all SA status changes in approver's practices
          if (matchingAssignment.webex_space_id) {
            try {
              const assignedPractices = matchingAssignment.practice ? matchingAssignment.practice.split(',').map(p => p.trim()).sort() : [];
              if (assignedPractices.length > 0) {
                const primaryPractice = assignedPractices[0];
                const webexBot = await db.getPracticeWebexBot(primaryPractice);
                
                if (webexBot && webexBot.accessToken) {
                  // Collect all status changes for approver's practices
                  const statusChanges = [];
                  for (const practice of approverUser.practices) {
                    for (const [completionKey, completion] of Object.entries(saCompletions)) {
                      if (completionKey.includes(`::${practice}`) && completion.approvedBy === approverUser.email) {
                        statusChanges.push({
                          saName: completionKey.split('::')[0].replace(/<[^>]+>/g, '').trim(),
                          oldStatus: 'Pending Approval',
                          newStatus: 'Complete'
                        });
                      }
                    }
                  }
                  
                  if (statusChanges.length > 0) {
                    const { saWebexService } = await import('./sa-webex-service.js');
                    await saWebexService.sendBatchedStatusChangeNotification(
                      matchingAssignment.webex_space_id,
                      matchingAssignment,
                      webexBot.accessToken,
                      statusChanges,
                      approverUser.practices[0]
                    );
                  }
                }
              }
            } catch (webexError) {
              logger.error('Failed to send batched Webex notification for SA Assignment Approved:', webexError);
            }
          }
          
          logger.info('SA Assignment Approved - statuses updated successfully', {
            saAssignmentId: matchingAssignment.id,
            opportunityId,
            approverEmail: approverUser.email,
            approverPractices: approverUser.practices,
            updatedCompletions: Object.keys(saCompletions).filter(key => 
              saCompletions[key].status === 'Complete' && saCompletions[key].approvedBy === approverUser.email
            )
          });
          
          return { success: true, result: { 
            saAssignmentId: matchingAssignment.id,
            approverEmail: approverUser.email,
            approverPractices: approverUser.practices,
            updatedCount: Object.keys(saCompletions).filter(key => 
              saCompletions[key].status === 'Complete' && saCompletions[key].approvedBy === approverUser.email
            ).length
          } };
        } else {
          logger.error('Failed to update SA assignment via API', {
            saAssignmentId: matchingAssignment.id,
            status: response.status,
            statusText: response.statusText
          });
          return { success: false, error: 'Failed to update SA assignment via API' };
        }
      } catch (apiError) {
        logger.error('Error calling SA assignment API for approval', {
          error: apiError.message,
          saAssignmentId: matchingAssignment.id
        });
        return { success: false, error: 'Failed to update SA assignment - API error' };
      }
      
    } catch (error) {
      logger.error('Error executing SA Assignment Approved action', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  async executeSaAssignmentApprovalRequestAction(email, rule) {
    try {
      logger.info('Processing SA Assignment Approval Request email', {
        subject: email.subject,
        from: email.from,
        bodyLength: email.body.length
      });
      
      // Extract data from email using keyword mappings
      const extractedData = await this.extractDataFromEmail(email, rule.keywordMappings);
      
      // Populate missing keywords with "Not Found"
      rule.keywordMappings.forEach(mapping => {
        if (!extractedData[mapping.field]) {
          extractedData[mapping.field] = 'Not Found';
          logger.info('SA Assignment Approval Request keyword not found, setting to default', {
            keyword: mapping.keyword,
            field: mapping.field,
            value: 'Not Found'
          });
        }
      });
      
      const opportunityId = extractedData.opportunityId;
      const saAssigned = extractedData.saAssigned;
      const revisionNumber = extractedData.revisionNumber;
      
      logger.info('SA Assignment Approval Request extracted data', {
        opportunityId,
        saAssigned,
        revisionNumber,
        revisionNumberFound: revisionNumber && revisionNumber !== 'Not Found'
      });
      
      if (!opportunityId || opportunityId === 'Not Found') {
        return { success: false, error: 'Opportunity ID not found in email' };
      }
      
      if (!saAssigned || saAssigned === 'Not Found') {
        return { success: false, error: 'Task Owner Name not found in email' };
      }
      
      // Find the email address for the Task Owner Name in the To: field
      let saEmail = null;
      if (extractedData.resourceAssignmentNotificationUsers && extractedData.resourceAssignmentNotificationUsers.length > 0) {
        const matchingUser = extractedData.resourceAssignmentNotificationUsers.find(user => 
          user.name.toLowerCase().includes(saAssigned.toLowerCase()) || 
          saAssigned.toLowerCase().includes(user.name.toLowerCase())
        );
        if (matchingUser) {
          saEmail = matchingUser.email;
          logger.info('Found matching email for Task Owner Name', {
            taskOwnerName: saAssigned,
            matchedEmail: saEmail,
            matchedUserName: matchingUser.name
          });
        }
      }
      
      if (!saEmail) {
        return { success: false, error: `Could not find email address for Task Owner Name "${saAssigned}" in To: field` };
      }
      
      // Find SA assignment with matching opportunity ID and SA email
      const allSaAssignments = await db.getAllSaAssignments();
      const matchingAssignment = allSaAssignments.find(assignment => {
        if (assignment.opportunityId !== opportunityId) {
          return false;
        }
        
        // Check if SA email is in practiceAssignments field (new data model)
        let practiceAssignmentsMatch = false;
        if (assignment.practiceAssignments) {
          try {
            const practiceAssignments = JSON.parse(assignment.practiceAssignments);
            // Check all practices for this SA email
            practiceAssignmentsMatch = Object.values(practiceAssignments).some(saList => 
              Array.isArray(saList) && saList.some(sa => sa.toLowerCase().includes(saEmail.toLowerCase()))
            );
          } catch (e) {
            // Ignore JSON parse errors
          }
        }
        
        // Fallback: check legacy saAssigned field for backwards compatibility
        let saAssignedMatch = false;
        if (assignment.saAssigned && !practiceAssignmentsMatch) {
          saAssignedMatch = assignment.saAssigned.toLowerCase().includes(saEmail.toLowerCase());
        }
        
        // Also check saCompletions for individual SA assignments by email
        let saCompletionsMatch = false;
        if (assignment.saCompletions) {
          try {
            const completions = JSON.parse(assignment.saCompletions);
            saCompletionsMatch = Object.keys(completions).some(saKey => saKey.toLowerCase().includes(saEmail.toLowerCase()));
          } catch (e) {
            // Ignore JSON parse errors
          }
        }
        
        return practiceAssignmentsMatch || saAssignedMatch || saCompletionsMatch;
      });
      
      if (!matchingAssignment) {
        logger.info('No matching SA assignment found for approval request', {
          opportunityId,
          taskOwnerName: saAssigned,
          saEmail,
          totalAssignments: allSaAssignments.length,
          availableAssignments: allSaAssignments.filter(a => a.opportunityId === opportunityId).map(a => ({
            id: a.id,
            practiceAssignments: a.practiceAssignments,
            saAssigned: a.saAssigned,
            saCompletions: a.saCompletions
          }))
        });
        return { success: false, error: `No SA assignment found for opportunity ID "${opportunityId}" and Task Owner "${saAssigned}" (${saEmail})` };
      }
      
      // Get current SA completions
      const saCompletions = JSON.parse(matchingAssignment.saCompletions || '{}');
      
      // Find the SA key that matches the email and update status to "Pending Approval"
      let saKey = null;
      for (const key of Object.keys(saCompletions)) {
        if (key.toLowerCase().includes(saEmail.toLowerCase())) {
          saKey = key;
          break;
        }
      }
      
      if (!saKey) {
        // Try to find SA in new practiceAssignments structure
        if (matchingAssignment.practiceAssignments) {
          try {
            const practiceAssignments = JSON.parse(matchingAssignment.practiceAssignments);
            for (const [practice, saList] of Object.entries(practiceAssignments)) {
              if (Array.isArray(saList)) {
                const matchingSA = saList.find(sa => sa.toLowerCase().includes(saEmail.toLowerCase()));
                if (matchingSA) {
                  saKey = matchingSA;
                  logger.info('Found SA in practiceAssignments for completion entry', {
                    saAssigned,
                    saEmail,
                    matchingSA,
                    practice,
                    opportunityId
                  });
                  break;
                }
              }
            }
          } catch (e) {
            logger.error('Error parsing practiceAssignments', { error: e.message });
          }
        }
        
        // Fallback: check legacy saAssigned field
        if (!saKey && matchingAssignment.saAssigned) {
          const saNames = matchingAssignment.saAssigned.split(',').map(s => s.trim());
          const matchingSAName = saNames.find(saName => saName.toLowerCase().includes(saEmail.toLowerCase()));
          
          if (matchingSAName) {
            saKey = matchingSAName;
            logger.info('Creating new SA completion entry for email-matched SA (legacy)', {
              saAssigned,
              saEmail,
              matchingSAName,
              opportunityId
            });
          }
        }
        
        if (!saKey) {
          return { success: false, error: `SA with email "${saEmail}" not found in assignment for opportunity ${opportunityId}` };
        }
      }
      
      // Find which practice this SA belongs to
      let targetPractice = null;
      if (matchingAssignment.practiceAssignments) {
        try {
          const practiceAssignments = JSON.parse(matchingAssignment.practiceAssignments);
          for (const [practice, saList] of Object.entries(practiceAssignments)) {
            if (Array.isArray(saList) && saList.some(sa => sa.toLowerCase().includes(saEmail.toLowerCase()))) {
              targetPractice = practice;
              break;
            }
          }
        } catch (e) {
          logger.error('Error parsing practiceAssignments for practice lookup', { error: e.message });
        }
      }
      
      // Use API route to update SA status (centralizes Webex notifications)
      try {
        const env = process.env.ENVIRONMENT || 'dev';
        const ssmPrefix = env === 'prod' ? '/PracticeTools' : `/PracticeTools/${env}`;
        // Use local environment variable first when in development, then fall back to SSM
        const baseUrl = process.env.NODE_ENV === 'development' ? 
          (process.env.NEXTAUTH_URL || 'http://localhost:3000') : 
          (await getSecureParameter(`${ssmPrefix}/NEXTAUTH_URL`) || process.env.NEXTAUTH_URL || 'http://localhost:3000');
        // Always fetch from SSM in dev to match App Runner
        let adminApiKey = await getSecureParameter(`${ssmPrefix}/ADMIN_API_KEY`);
        if (!adminApiKey) {
          adminApiKey = process.env.ADMIN_API_KEY;
        }
        

        
        const requestBody = {
          updateSAStatus: true,
          targetSA: saKey,
          saStatus: 'Pending Approval',
          revisionNumber: revisionNumber && revisionNumber !== 'Not Found' ? revisionNumber : null
        };
        
        logger.info('Making API call to update SA status', {
          url: `${baseUrl}/api/sa-assignments/${matchingAssignment.id}`,
          requestBody,
          hasRevisionNumber: !!requestBody.revisionNumber,
          revisionNumberValue: requestBody.revisionNumber
        });
        
        const response = await fetch(`${baseUrl}/api/sa-assignments/${matchingAssignment.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-service-auth': adminApiKey,
            'x-service-source': 'email-processor'
          },
          body: JSON.stringify(requestBody)
        });
        
        if (response.ok) {
          logger.info('Individual SA status updated to Pending Approval via API', {
            saAssignmentId: matchingAssignment.id,
            opportunityId,
            saEmail,
            saKey,
            previousOverallStatus: matchingAssignment.status,
            individualSAStatus: 'Pending Approval'
          });
          
          // DSR: Collect all status changes for batched notification
          const allStatusChanges = [];
          
          // Find which practices the requestor (saEmail) belongs to and only update SAs in those practices
          const allUsers = await db.getAllUsers();
          const requestorUser = allUsers.find(user => 
            user.email.toLowerCase() === saEmail.toLowerCase()
          );
          
          let requestorPractices = [];
          if (requestorUser && requestorUser.practices) {
            requestorPractices = requestorUser.practices;
            logger.info('Found requestor practices', {
              requestorEmail: saEmail,
              requestorPractices
            });
          } else {
            logger.warn('Requestor user not found or has no practices', {
              requestorEmail: saEmail
            });
          }
          
          // Only update SAs in practices that the requestor belongs to
          if (requestorPractices.length > 0 && matchingAssignment.practiceAssignments) {
            try {
              const practiceAssignments = JSON.parse(matchingAssignment.practiceAssignments);
              
              // Update SAs in each of the requestor's practices
              for (const requestorPractice of requestorPractices) {
                const practicesSAs = practiceAssignments[requestorPractice] || [];
                
                logger.info('Updating SAs in requestor practice', {
                  practice: requestorPractice,
                  sasInPractice: practicesSAs.length
                });
                
                // Update all SAs in this practice to Pending Approval with revision number
                for (const practicesSA of practicesSAs) {
                  const otherSAResponse = await fetch(`${baseUrl}/api/sa-assignments/${matchingAssignment.id}`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      'x-service-auth': adminApiKey,
                      'x-service-source': 'email-processor'
                    },
                    body: JSON.stringify({
                      updateSAStatus: true,
                      targetSA: practicesSA,
                      saStatus: 'Pending Approval',
                      revisionNumber: revisionNumber && revisionNumber !== 'Not Found' ? revisionNumber : null
                    })
                  });
                  
                  if (!otherSAResponse.ok) {
                    logger.error('Failed to update requestor practice SA status via API', {
                      saAssignmentId: matchingAssignment.id,
                      targetSA: practicesSA,
                      practice: requestorPractice,
                      status: otherSAResponse.status
                    });
                  } else {
                    logger.info('Updated SA in requestor practice', {
                      targetSA: practicesSA,
                      practice: requestorPractice,
                      revisionNumber: revisionNumber && revisionNumber !== 'Not Found' ? revisionNumber : null
                    });
                  }
                }
              }
              
              // Send batched Webex notification for all SA status changes in requestor's practices
              if (matchingAssignment.webex_space_id) {
                try {
                  const assignedPractices = matchingAssignment.practice ? matchingAssignment.practice.split(',').map(p => p.trim()).sort() : [];
                  if (assignedPractices.length > 0) {
                    const primaryPractice = assignedPractices[0];
                    const webexBot = await db.getPracticeWebexBot(primaryPractice);
                    
                    if (webexBot && webexBot.accessToken) {
                      // Collect all status changes for requestor's practices
                      const allStatusChanges = [];
                      for (const requestorPractice of requestorPractices) {
                        const practicesSAs = practiceAssignments[requestorPractice] || [];
                        const statusChanges = practicesSAs.map(sa => ({
                          saName: sa.replace(/<[^>]+>/g, '').trim(),
                          oldStatus: 'In Progress',
                          newStatus: 'Pending Approval'
                        }));
                        allStatusChanges.push(...statusChanges);
                      }
                      
                      if (allStatusChanges.length > 0) {
                        const { saWebexService } = await import('./sa-webex-service.js');
                        await saWebexService.sendBatchedStatusChangeNotification(
                          matchingAssignment.webex_space_id,
                          matchingAssignment,
                          webexBot.accessToken,
                          allStatusChanges,
                          requestorPractices[0] // Use first requestor practice
                        );
                      }
                    }
                  }
                } catch (webexError) {
                  logger.error('Failed to send batched Webex notification:', webexError);
                }
              }
              
              logger.info('Updated all SAs in requestor practices to Pending Approval via API', {
                requestorPractices,
                totalUpdatedSAs: requestorPractices.reduce((total, practice) => 
                  total + (practiceAssignments[practice] || []).length, 0
                ),
                opportunityId
              });
            } catch (e) {
              logger.error('Error updating practice SAs to Pending Approval via API', { error: e.message });
            }
          }
          
          return { success: true, result: { 
            saAssignmentId: matchingAssignment.id, 
            individualSAStatus: 'Pending Approval',
            saEmail: saEmail
          } };
        } else {
          logger.error('Failed to update SA status via API', {
            saAssignmentId: matchingAssignment.id,
            status: response.status,
            statusText: response.statusText
          });
          return { success: false, error: 'Failed to update individual SA status via API' };
        }
      } catch (apiError) {
        logger.error('Error calling SA assignment API from email processor', {
          error: apiError.message,
          saAssignmentId: matchingAssignment.id
        });
        return { success: false, error: 'Failed to update individual SA status - API error' };
      }
      
    } catch (error) {
      logger.error('Error executing SA Assignment Approval Request action', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  async executeSaAssignmentAction(email, rule) {
    try {
      logger.info('Full email body for SA assignment debugging', {
        fullEmailBody: email.body,
        bodyLength: email.body.length
      });
      
      // Extract data from email using keyword mappings
      const extractedData = await this.extractDataFromEmail(email, rule.keywordMappings);
      
      // Populate missing keywords with "Not Found" (excluding To: which is handled specially)
      const requiredMappings = rule.keywordMappings.filter(m => m.keyword.toLowerCase() !== 'to:');
      requiredMappings.forEach(mapping => {
        if (!extractedData[mapping.field]) {
          extractedData[mapping.field] = 'Not Found';
          logger.info('SA assignment keyword not found, setting to default', {
            keyword: mapping.keyword,
            field: mapping.field,
            value: 'Not Found'
          });
        }
      });
      
      const missingCount = requiredMappings.filter(m => extractedData[m.field] === 'Not Found').length;
      if (missingCount > 0) {
        logger.warn('Some keywords not found in SA assignment email, using default values', { 
          emailId: email.id,
          total: requiredMappings.length,
          missing: missingCount,
          missingKeywords: requiredMappings.filter(m => extractedData[m.field] === 'Not Found').map(m => m.keyword)
        });
      }

      // Check for duplicate opportunity ID before processing
      if (extractedData.opportunityId && extractedData.opportunityId !== 'Not Found') {
        const existingSaAssignments = await db.getAllSaAssignments();
        const duplicateAssignment = existingSaAssignments.find(assignment => 
          assignment.opportunityId === extractedData.opportunityId
        );
        
        if (duplicateAssignment) {
          logger.info('Skipping SA assignment creation - duplicate opportunity ID found', {
            opportunityId: extractedData.opportunityId,
            existingAssignmentId: duplicateAssignment.id,
            existingAssignmentNumber: duplicateAssignment.sa_assignment_number,
            emailId: email.id
          });
          return { 
            success: true, 
            result: { 
              skipped: true, 
              reason: 'Duplicate opportunity ID', 
              opportunityId: extractedData.opportunityId,
              existingAssignmentId: duplicateAssignment.id 
            } 
          };
        }
      }

      // Extract To: users for SA assignment mapping from the forwarded email
      const emailContent = email.body.toLowerCase();
      
      // Look for the forwarded email's To: line (after "From:" and before "Cc:")
      const fromIndex = emailContent.indexOf('from:');
      let toUsers = [];
      
      if (fromIndex !== -1) {
        // Look for "To:" after the "From:" line in the forwarded email
        const afterFrom = emailContent.substring(fromIndex);
        const toIndex = afterFrom.indexOf('to:');
        
        if (toIndex !== -1) {
          const actualToIndex = fromIndex + toIndex;
          toUsers = await this.extractToUsers(email.body, actualToIndex);
          logger.info('Found forwarded email To: section', { 
            fromIndex: fromIndex,
            toIndex: actualToIndex,
            userCount: toUsers.length 
          });
        } else {
          logger.info('No To: section found in forwarded email');
        }
      } else {
        logger.info('No From: section found - not a forwarded email');
      }
      
      if (toUsers.length === 0 || toUsers.some(u => !u.email)) {
        const toMatch = email.body.match(/To:\s*([^\n\r]+)/i);
        if (toMatch) {
          const toLine = toMatch[1].trim();
          const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
          const toLineEmails = toLine.match(emailRegex) || [];
          const users = await db.getAllUsers();
          
          if (toLineEmails.length > 0) {
            const emailToUsers = [];
            for (const emailAddr of toLineEmails) {
              const matchedUser = users.find(u => u.email.toLowerCase() === emailAddr.toLowerCase());
              if (matchedUser) {
                emailToUsers.push({ name: matchedUser.name, email: matchedUser.email });
              }
            }
            if (emailToUsers.length > 0) {
              toUsers = emailToUsers;
            }
          } else {
            const names = toLine.split(/[;,]/).map(name => name.trim()).filter(name => name);
            const enhancedToUsers = [];
            for (const name of names) {
              const matchedUser = users.find(u => u.name.toLowerCase() === name.toLowerCase());
              if (matchedUser) {
                enhancedToUsers.push({ name: matchedUser.name, email: matchedUser.email });
              }
            }
            if (enhancedToUsers.length > 0) {
              toUsers = enhancedToUsers;
            }
          }
        }
      }
      
      // Special handling for SA assignments: map To: users to AM, ISR, and notification users
      if (toUsers && toUsers.length > 0) {
        // Map first user to AM
        if (toUsers.length >= 1) {
          extractedData.am = `${toUsers[0].name} <${toUsers[0].email}>`;
          logger.info('Mapped first To: user to AM', { 
            name: toUsers[0].name, 
            email: toUsers[0].email,
            formatted: extractedData.am
          });
        }
        
        // Map second user to ISR if available
        if (toUsers.length >= 2) {
          extractedData.isr = `${toUsers[1].name} <${toUsers[1].email}>`;
          logger.info('Mapped second To: user to ISR', { 
            name: toUsers[1].name, 
            email: toUsers[1].email,
            formatted: extractedData.isr
          });
        }
        
        // DSR: To: users are for AM/ISR mapping only, not notifications
        logger.info('DSR: To: users mapped to AM/ISR only (not notification users)', {
          userCount: toUsers.length,
          users: toUsers.map(u => ({ name: u.name, email: u.email }))
        });
      }

      logger.info('Creating SA assignment from email', { 
        projectNumber: extractedData.projectNumber,
        customerName: extractedData.customerName,
        am: extractedData.am,
        isr: extractedData.isr
      });

      // Generate SCOOP URL if opportunity ID is available
      let scoopUrl = extractedData.scoopUrl || '';
      if (extractedData.opportunityId && !scoopUrl) {
        scoopUrl = `https://scoop.netsync.com/opportunity/index?no=${extractedData.opportunityId}`;
        logger.info('Generated SCOOP URL from opportunity ID', {
          opportunityId: extractedData.opportunityId,
          scoopUrl: scoopUrl
        });
      }

      // Extract and match practice from Technologies section
      const practiceResult = await extractAndMatchPractice(email.body);
      extractedData.practice = practiceResult.practices;
      extractedData.practiceAssignments = practiceResult.saAssignments;
      logger.info('Extracted and matched practice from Technologies section', {
        matched: practiceResult.practices,
        saAssignments: practiceResult.saAssignments
      });
      
      // DSR: Auto-populate notification users for matched practices if no CC users
      if ((!extractedData.saAssignmentNotificationUsers || extractedData.saAssignmentNotificationUsers.length === 0) && 
          extractedData.practice && extractedData.practice !== 'Pending') {
        try {
          const users = await db.getAllUsers();
          const matchedPractices = extractedData.practice.split(',').map(p => p.trim());
          
          const practiceManagers = users.filter(user => 
            user.role === 'practice_manager' && 
            user.practices && 
            user.practices.some(userPractice => matchedPractices.includes(userPractice))
          );
          const practicePrincipals = users.filter(user => 
            user.role === 'practice_principal' && 
            user.practices && 
            user.practices.some(userPractice => matchedPractices.includes(userPractice))
          );
          
          const autoNotificationUsers = [...practiceManagers, ...practicePrincipals].map(user => ({
            name: user.name,
            email: user.email
          }));
          
          extractedData.saAssignmentNotificationUsers = autoNotificationUsers;
          
          logger.info('DSR: Auto-populated notification users for matched practices', {
            matchedPractices,
            practiceManagerCount: practiceManagers.length,
            practicePrincipalCount: practicePrincipals.length,
            totalNotificationUsers: autoNotificationUsers.length
          });
        } catch (error) {
          logger.error('Error auto-populating notification users for matched practices', { error: error.message });
        }
      }
      
      // Extract SA names from Technologies section if not already extracted
      if (!extractedData.practiceAssignments || Object.keys(extractedData.practiceAssignments).length === 0) {
        const techSection = email.body.match(/Technologies:[\s\S]*?(?=Submited By:|$)/i);
        if (techSection) {
          const saNames = [];
          const lines = techSection[0].split(/\n|&#xd;/i);
          
          for (const line of lines) {
            const cleanLine = line.replace(/&#x[da];?/gi, '').trim();
            // Look for SA names in format: "Technology Name SA Name SA requested"
            const match = cleanLine.match(/^([^\s]+(?:\s+\([^)]+\))?)[\s]+([a-zA-Z\s]+?)[\s]+(yes|no)$/i);
            if (match) {
              const saName = match[2].trim();
              if (saName && saName.length > 2) {
                saNames.push(saName);
              }
            }
          }
          
          if (saNames.length > 0) {
            extractedData.saAssigned = saNames.join(', ');
            logger.info('Extracted SA names from Technologies section', {
              saNames: saNames,
              combined: extractedData.saAssigned
            });
          }
        }
      }

      // DSR: Process all user fields to ensure name and email pairs
      const users = await db.getAllUsers();
      let amRegion = null;
      
      // Process AM field
      if (extractedData.am) {
        const amEmailMatch = extractedData.am.match(/<([^>]+)>/);
        if (amEmailMatch) {
          const amUser = users.find(u => u.email.toLowerCase() === amEmailMatch[1].toLowerCase());
          if (amUser) {
            extractedData.am = `${amUser.name} <${amUser.email}>`;
            amRegion = amUser.region;
          }
        }
      }
      
      // Process ISR field
      if (extractedData.isr) {
        const isrEmailMatch = extractedData.isr.match(/<([^>]+)>/);
        if (isrEmailMatch) {
          const isrUser = users.find(u => u.email.toLowerCase() === isrEmailMatch[1].toLowerCase());
          if (isrUser) {
            extractedData.isr = `${isrUser.name} <${isrUser.email}>`;
          }
        }
      }
      
      // Process Submitted By field
      if (extractedData.submittedBy && !extractedData.submittedBy.includes('@')) {
        const submittedByUser = users.find(u => u.name.toLowerCase() === extractedData.submittedBy.toLowerCase());
        if (submittedByUser) {
          extractedData.submittedBy = `${submittedByUser.name} <${submittedByUser.email}>`;
        }
      }

      logger.info('DEBUG: Final extractedData before addSaAssignment', {
        saAssignmentNotificationUsers: extractedData.saAssignmentNotificationUsers,
        resourceAssignmentNotificationUsers: extractedData.resourceAssignmentNotificationUsers,
        allExtractedFields: Object.keys(extractedData)
      });
      
      logger.info('About to call db.addSaAssignment with parameters', {
        practice: extractedData.practice || 'Pending',
        status: 'Pending',
        opportunityId: extractedData.opportunityId || '',
        scoopUrl: scoopUrl,
        notificationUsers: extractedData.saAssignmentNotificationUsers || [],
        notificationUsersCount: (extractedData.saAssignmentNotificationUsers || []).length
      });
      
      // Convert SA assignments to comma-separated string for legacy field
      let saAssignedString = '';
      if (extractedData.practiceAssignments && Object.keys(extractedData.practiceAssignments).length > 0) {
        const allSAs = [];
        Object.values(extractedData.practiceAssignments).forEach(saList => {
          allSAs.push(...saList);
        });
        saAssignedString = allSAs.join(', ');
      }
      
      const saAssignmentId = await db.addSaAssignment(
        extractedData.practice || 'Pending', // practice - use extracted or default to Pending
        'Pending', // status
        extractedData.opportunityId || '', // opportunityId
        new Date().toISOString().split('T')[0], // requestDate
        extractedData.eta || '', // eta
        extractedData.customerName || '', // customerName
        extractedData.opportunityName || email.subject, // opportunityName
        amRegion || (extractedData.region || '').toUpperCase(), // DSR: Use AM's region first, then extracted region
        extractedData.am || '', // am
        saAssignedString, // saAssigned - SAs from Technologies section
        saAssignedString ? new Date().toISOString().split('T')[0] : '', // dateAssigned - set if SAs assigned
        extractedData.notes || '', // notes
        [], // attachments
        (extractedData.saAssignmentNotificationUsers || []).filter(u => u.email && u.email.includes('@')), // DSR: only users with valid emails
        scoopUrl, // SCOOP URL (generated or extracted)
        extractedData.isr || '', // ISR
        extractedData.submittedBy || '' // submittedBy
      );
      
      // Update SA assignment with practice assignments if we have them
      if (saAssignmentId && extractedData.practiceAssignments && Object.keys(extractedData.practiceAssignments).length > 0) {
        try {
          await db.updateSaAssignment(saAssignmentId, {
            practiceAssignments: JSON.stringify(extractedData.practiceAssignments)
          });
          logger.info('Updated SA assignment with practice assignments', {
            saAssignmentId,
            practiceAssignments: extractedData.practiceAssignments
          });
        } catch (updateError) {
          logger.error('Failed to update SA assignment with practice assignments', {
            saAssignmentId,
            error: updateError.message
          });
        }
      }
      
      logger.info('db.addSaAssignment completed', { saAssignmentId });
      
      if (saAssignmentId) {
        logger.info('SA assignment created successfully', { 
          saAssignmentId,
          emailId: email.id 
        });
        
        // Attempt auto-assignment first, then send appropriate email based on final status
        let finalSaAssignment = await db.getSaAssignmentById(saAssignmentId);
        let autoAssignmentPerformed = false;
        
        // Attempt auto-assignment of SAs based on SA to AM mapping
        try {
          logger.info('Attempting SA auto-assignment', { saAssignmentId });
          const autoAssignResult = await saAutoAssignment.processAutoAssignment(saAssignmentId);
          
          if (autoAssignResult.success) {
            autoAssignmentPerformed = true;
            logger.info('SA auto-assignment completed successfully', {
              saAssignmentId,
              assignedSas: autoAssignResult.assignedSas,
              region: autoAssignResult.region,
              message: autoAssignResult.message
            });
            
            // Get updated assignment after auto-assignment
            finalSaAssignment = await db.getSaAssignmentById(saAssignmentId);
          } else {
            logger.info('SA auto-assignment not performed', {
              saAssignmentId,
              reason: autoAssignResult.message
            });
          }
        } catch (autoAssignError) {
          logger.error('SA auto-assignment failed but SA assignment was created', {
            saAssignmentId,
            error: autoAssignError.message
          });
          // Don't fail the overall process if auto-assignment fails
        }
        
        // Send appropriate email notification based on final status after auto-assignment
        if (finalSaAssignment) {
          logger.info('Checking final SA assignment status for email notification', {
            saAssignmentId,
            status: finalSaAssignment.status,
            practice: finalSaAssignment.practice,
            autoAssignmentPerformed,
            isPending: finalSaAssignment.status === 'Pending',
            isUnassigned: finalSaAssignment.status === 'Unassigned',
            isAssigned: finalSaAssignment.status === 'Assigned',
            hasPractice: !!finalSaAssignment.practice,
            practiceNotPending: finalSaAssignment.practice !== 'Pending'
          });
          
          try {
            if (finalSaAssignment.status === 'Pending') {
              await saEmailService.sendPendingSAAssignmentNotification(finalSaAssignment);
              logger.info('Pending SA assignment email notification sent', { saAssignmentId });
            } else if (finalSaAssignment.status === 'Unassigned' && finalSaAssignment.practice && finalSaAssignment.practice !== 'Pending') {
              await saEmailService.sendPracticeAssignedNotification(finalSaAssignment);
              logger.info('Practice assigned SA assignment email notification sent', { saAssignmentId });
            } else if (finalSaAssignment.status === 'Assigned' && (finalSaAssignment.practiceAssignments || finalSaAssignment.saAssigned)) {
              // Create Webex space first, then send email with space ID
              const { saWebexService } = await import('./sa-webex-service.js');
              const spaceId = await saWebexService.createSASpace(finalSaAssignment);
              if (spaceId) {
                // Get final assignment with space ID for email
                const finalAssignmentWithSpace = await db.getSaAssignmentById(saAssignmentId);
                await saEmailService.sendSAAssignedNotification(finalAssignmentWithSpace);
              } else {
                // Send email without space ID if creation failed
                await saEmailService.sendSAAssignedNotification(finalSaAssignment);
              }
              logger.info('SA assigned email notification sent', { saAssignmentId });
            } else {
              logger.info('No email notification sent - conditions not met', {
                saAssignmentId,
                status: finalSaAssignment.status,
                practice: finalSaAssignment.practice
              });
            }
          } catch (emailError) {
            logger.error('Failed to send SA assignment email from email processor', {
              saAssignmentId,
              status: finalSaAssignment.status,
              practice: finalSaAssignment.practice,
              error: emailError.message
            });
            // Don't fail the overall process if email fails
          }
        }
        
        return { success: true, result: { saAssignmentId, finalStatus: finalSaAssignment?.status } };
      } else {
        return { success: false, error: 'Failed to create SA assignment' };
      }
      
    } catch (error) {
      logger.error('Error executing SA assignment action', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  matchesRule(email, rule) {
    logger.info('Checking rule match', {
      emailFrom: email.from,
      emailSubject: email.subject,
      ruleSenderEmail: rule.senderEmail,
      ruleSubjectPattern: rule.subjectPattern,
      ruleBodyPattern: rule.bodyPattern,
      ruleName: rule.name
    });
    
    // Check sender email (skip if 'anyone' or empty)
    if (rule.senderEmail && rule.senderEmail !== 'anyone' && rule.senderEmail.trim() !== '' && !email.from.toLowerCase().includes(rule.senderEmail.toLowerCase())) {
      logger.info('Rule failed sender email check', {
        ruleSenderEmail: rule.senderEmail,
        emailFrom: email.from
      });
      return false;
    }

    // Check subject pattern (if specified)
    if (rule.subjectPattern && rule.subjectPattern.trim() !== '' && !email.subject.toLowerCase().includes(rule.subjectPattern.toLowerCase())) {
      logger.info('Rule failed subject pattern check', {
        ruleSubjectPattern: rule.subjectPattern,
        emailSubject: email.subject
      });
      return false;
    }

    // Check body pattern (if specified)
    if (rule.bodyPattern && rule.bodyPattern.trim() !== '' && !email.body.toLowerCase().includes(rule.bodyPattern.toLowerCase())) {
      logger.info('Rule failed body pattern check', {
        ruleBodyPattern: rule.bodyPattern,
        emailBodySample: email.body.substring(0, 100) + '...'
      });
      return false;
    }

    logger.info('Rule matched successfully', { ruleName: rule.name });
    return true;
  }

  async extractDataFromEmail(email, keywordMappings) {
    const extractedData = {};
    const originalEmailContent = `${email.subject}
${email.body}`;
    const emailContent = originalEmailContent.toLowerCase();
    let ccUsersBackup = null; // Store CC users to prevent overwriting

    for (const mapping of keywordMappings) {
      if (!mapping.keyword || !mapping.field) continue;

      const keyword = mapping.keyword.toLowerCase();
      const keywordIndex = emailContent.indexOf(keyword);

      if (keywordIndex !== -1) {
        // Special handling for "To:" keyword - only for AM/ISR mapping, not notifications
        if (keyword === 'to:') {
          // Find the actual "To:" line in the forwarded email
          const forwardedToMatch = emailContent.match(/\bto:\s*([^\n]*)/i);
          if (forwardedToMatch) {
            const toUsers = await this.parseToLine(forwardedToMatch[1]);
            if (toUsers.length > 0) {
              // DSR: To: field users are for AM/ISR mapping only, not notifications
              if (mapping.field === 'sa_assignment_approved_notification_users') {
                extractedData.saAssignmentApprovedNotificationUsers = toUsers;
                logger.info('Setting SA Assignment Approved notification users from To: field', {
                  toUsers: toUsers,
                  userCount: toUsers.length
                });
              } else {
                // Store To: users for AM/ISR mapping but not as notification users
                extractedData.resourceAssignmentNotificationUsers = toUsers;
                logger.info('Extracted To: users for AM/ISR mapping (not notifications)', { 
                  keyword: mapping.keyword,
                  field: mapping.field,
                  userCount: toUsers.length,
                  users: toUsers,
                  rawToLine: forwardedToMatch[1]
                });
              }
            }
          }
          continue;
        }
        
        // Special handling for "Submitted By:" or "Submited By:" (handle typo)
        if (keyword === 'submitted by:' || keyword === 'submited by:') {
          const submittedByMatch = emailContent.match(/\bsubmit[te]d by:\s*([^\n]*)/i);
          if (submittedByMatch) {
            let submittedBy = submittedByMatch[1].trim();
            // Clean mailto links and HTML entities
            submittedBy = submittedBy
              .replace(/<mailto:[^>]+>/g, '')
              .replace(/&#xd;?/gi, '')
              .replace(/&#xa;?/gi, '')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&amp;/g, '&')
              .trim();
            if (submittedBy) {
              extractedData[mapping.field] = submittedBy;
              logger.info('Extracted Submitted By', { 
                keyword: mapping.keyword,
                field: mapping.field,
                value: submittedBy,
                rawMatch: submittedByMatch[1]
              });
            }
          }
          continue;
        }

        // Special handling for "Technologies" keyword to capture everything until "Submitted By"
        if (keyword === 'technologies') {
          const submitedByIndex = emailContent.indexOf('submited by:');
          if (submitedByIndex !== -1 && submitedByIndex > keywordIndex) {
            // Extract everything between "Technologies:" and "Submitted By:"
            const sectionContent = emailContent.substring(keywordIndex, submitedByIndex);
            // Clean HTML entities and format
            const cleanContent = sectionContent
              .replace(/&#xd;/gi, '\n')
              .replace(/&#xa;/gi, '\n')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&amp;/g, '&')
              .replace(/\n\s*\n/g, '\n') // Remove extra blank lines
              .trim();
            
            extractedData[mapping.field] = cleanContent;
            logger.info('Extracted Technologies content', { 
              keyword: mapping.keyword,
              field: mapping.field,
              content: cleanContent
            });
          }
          continue;
        }



        // Extract text after the keyword - use original content for URLs to preserve case
        const afterKeyword = mapping.field === 'documentationLink' ? 
          originalEmailContent.substring(keywordIndex + keyword.length) :
          emailContent.substring(keywordIndex + keyword.length);
        
        logger.info('Debug extraction', {
          keyword: mapping.keyword,
          afterKeywordSample: afterKeyword.substring(0, 100),
          keywordIndex
        });
        
        // Split by both \n and &#xD; to handle different line break formats
        const lines = afterKeyword.split(/\n|&#xd;/i);
        let extractedValue = '';
        
        logger.info('Debug lines', {
          keyword: mapping.keyword,
          linesCount: lines.length,
          firstFewLines: lines.slice(0, 5)
        });
        
        // Get the first line after the keyword
        if (lines[0]) {
          const firstLineMatch = lines[0].match(/[:\-\s]*(.+)/);
          if (firstLineMatch && firstLineMatch[1].trim()) {
            extractedValue = firstLineMatch[1].trim();
          }
        }
        
        // If first line is empty or just separators, check next lines
        if (!extractedValue && lines.length > 1) {
          for (let i = 1; i < Math.min(lines.length, 10); i++) {
            const lineContent = lines[i].trim();
            if (lineContent && !lineContent.match(/^[\s\-:]*$/) && lineContent !== '') {
              extractedValue = lineContent;
              break;
            }
          }
        }
        
        // Special validation for region field - only accept valid region codes
        if (mapping.field === 'region' && extractedValue) {
          const validRegions = [
            'CA-LAX', 'CA-SAN', 'CA-SFO', 'FL-MIA', 'FL-NORT', 'KY-KENT', 
            'LA-STATE', 'OK-OKC', 'OTHERS', 'TN-TEN', 'TX-CEN', 'TX-DAL', 
            'TX-HOU', 'TX-SOUT', 'US-FED', 'US-SP'
          ];
          const upperValue = extractedValue.toUpperCase().trim();
          
          // Reject if extracted value is too long (likely wrong data)
          if (upperValue.length > 20) {
            logger.warn('Region value too long, likely incorrect extraction', {
              keyword: mapping.keyword,
              extractedValue: extractedValue,
              length: extractedValue.length
            });
            extractedValue = '';
          } else {
            // Check for exact match or partial match with valid regions
            const matchedRegion = validRegions.find(region => 
              upperValue === region || 
              upperValue.includes(region) || 
              region.includes(upperValue)
            );
            
            if (matchedRegion) {
              extractedValue = matchedRegion;
              logger.info('Valid region matched', {
                keyword: mapping.keyword,
                originalValue: extractedValue,
                matchedRegion: matchedRegion
              });
            } else {
              logger.warn('Invalid region extracted, setting to empty', {
                keyword: mapping.keyword,
                extractedValue: extractedValue,
                validRegions: validRegions
              });
              extractedValue = '';
            }
          }
        }
        
        logger.info('Debug extracted value', {
          keyword: mapping.keyword,
          rawValue: extractedValue,
          hasValue: !!extractedValue
        });
        
        if (extractedValue) {
          // Clean HTML entities
          extractedValue = extractedValue
            .replace(/&#xd;?/gi, '')
            .replace(/&#xa;?/gi, '')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .trim();
          
          if (extractedValue) {
            // Clean opportunity name by removing hyperlinks
            if (mapping.field === 'opportunityName') {
              extractedValue = this.cleanOpportunityName(extractedValue);
            }
            
            // DSR: Special handling for CC field - only CC users are notification users
            if (mapping.field === 'sa_assignment_notification_users') {
              const ccUsers = await this.parseToLine(extractedValue);
              extractedData[mapping.field] = ccUsers;
              extractedData.saAssignmentNotificationUsers = ccUsers; // Also set the main field
              ccUsersBackup = ccUsers; // Store CC users to prevent overwriting
              logger.info('DSR: Extracted CC users as notification users', { 
                keyword: mapping.keyword,
                field: mapping.field,
                userCount: ccUsers.length,
                users: ccUsers,
                rawValue: extractedValue
              });
            } else if (mapping.field === 'sa_assignment_approved_notification_users') {
              const approvedUsers = await this.parseToLine(extractedValue);
              extractedData[mapping.field] = approvedUsers;
              extractedData.saAssignmentApprovedNotificationUsers = approvedUsers; // Also set the main field
              logger.info('Extracted and parsed SA Assignment Approved users', { 
                keyword: mapping.keyword,
                field: mapping.field,
                userCount: approvedUsers.length,
                users: approvedUsers,
                rawValue: extractedValue
              });
            } else {
              extractedData[mapping.field] = extractedValue;
              logger.info('Extracted data from email', { 
                keyword: mapping.keyword,
                field: mapping.field,
                value: extractedValue 
              });
            }
          }
        }
      }
    }

    // DSR: Final check - ensure only CC users are notification users
    if (ccUsersBackup && ccUsersBackup.length > 0) {
      extractedData.saAssignmentNotificationUsers = ccUsersBackup;
      logger.info('DSR: Final notification users - using CC users only', {
        ccUsers: ccUsersBackup,
        userCount: ccUsersBackup.length
      });
    } else {
      // DSR: If no CC users found, auto-populate with practice managers and principals for matched practices only
      extractedData.saAssignmentNotificationUsers = [];
      logger.info('DSR: No CC users found - will auto-populate after practice matching');
    }
    
    return extractedData;
  }

  cleanDocumentationLink(link) {
    if (!link) return '';
    
    let cleanedLink = link;
    
    // Extract URL from text like "job documentation <https://...>"
    const urlMatch = link.match(/<(https?:\/\/[^>]+)>/);
    if (urlMatch) {
      cleanedLink = urlMatch[1];
    }
    
    // Properly decode HTML entities (handle double-encoded entities)
    cleanedLink = cleanedLink
      .replace(/&amp;amp;/g, '&')  // Double-encoded ampersand
      .replace(/&amp;/g, '&')      // Single-encoded ampersand
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    
    return cleanedLink;
  }

  cleanOpportunityName(name) {
    if (!name) return '';
    
    // Remove hyperlinks like "<https://scoop.netsync.com/opportunity/index?no=340006332>"
    return name.replace(/<https?:\/\/[^>]+>/g, '').trim();
  }

  extractPMName(pmText) {
    if (!pmText) return '';
    
    // Extract name from "Keith Arnst <karnst@netsync.com>" format
    const nameMatch = pmText.match(/^([^<]+)/);
    if (nameMatch) {
      const name = nameMatch[1].trim();
      // Capitalize first letter of each word
      return name.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
    }
    
    return pmText;
  }

  extractPMEmail(pmText) {
    if (!pmText) return '';
    
    // Extract email from "Keith Arnst <karnst@netsync.com>" format
    const emailMatch = pmText.match(/<([^>]+)>/);
    if (emailMatch) {
      return emailMatch[1];
    }
    
    return '';
  }

  async extractToUsers(emailContent, startIndex) {
    const afterKeyword = emailContent.substring(startIndex);
    const lines = afterKeyword.split(/\n|&#xd;/i);
    const users = [];
    
    let toLine = '';
    if (lines[0]) {
      const firstLineMatch = lines[0].match(/[:\-\s]*(.+)/);
      if (firstLineMatch && firstLineMatch[1].trim()) {
        toLine = firstLineMatch[1].trim();
      }
    }
    
    if (!toLine && lines.length > 1) {
      for (let i = 1; i < Math.min(lines.length, 5); i++) {
        const lineContent = lines[i].trim();
        if (lineContent && !lineContent.match(/^[\s\-:]*$/) && lineContent !== '') {
          toLine = lineContent;
          break;
        }
      }
    }
    
    if (toLine) {
      toLine = toLine
        .replace(/&#xd;?/gi, '')
        .replace(/&#xa;?/gi, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .trim();
      
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const foundEmails = toLine.match(emailRegex) || [];
      const allUsers = await db.getAllUsers();
      
      if (foundEmails.length > 0) {
        for (const emailAddr of foundEmails) {
          const matchedUser = allUsers.find(u => u.email.toLowerCase() === emailAddr.toLowerCase());
          if (matchedUser) {
            users.push({ name: matchedUser.name, email: matchedUser.email });
          }
        }
        return users;
      }
      
      const recipients = toLine.split(/[;,]/);
      
      for (const recipient of recipients) {
        let cleanRecipient = recipient.trim();
        
        if (cleanRecipient) {
          let name = '';
          let email = '';
          
          const angleMatch = cleanRecipient.match(/^(.+?)\s*<([^>]+)>/);
          if (angleMatch) {
            name = angleMatch[1].trim().replace(/^To:\s*/i, '').replace(/^To\s+/i, '');
            email = angleMatch[2].trim();
          } else {
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            const cleanEmail = cleanRecipient.replace(/>/g, '').trim();
            
            if (emailRegex.test(cleanEmail)) {
              email = cleanEmail;
              const matchedUser = allUsers.find(u => u.email.toLowerCase() === cleanEmail.toLowerCase());
              name = matchedUser ? matchedUser.name : cleanEmail;
            } else {
              const displayName = cleanRecipient.replace(/^To:\s*/i, '').replace(/^To\s+/i, '').trim();
              const matchedUser = allUsers.find(u => u.name.toLowerCase() === displayName.toLowerCase());
              
              if (matchedUser) {
                name = matchedUser.name;
                email = matchedUser.email;
              }
            }
          }
          
          if (email && email.includes('@')) {
            users.push({ name: name || email, email: email });
          }
        }
      }
    }
    
    return users;
  }

  async parseToLine(toLine) {
    const users = [];
    
    if (toLine) {
      toLine = toLine
        .replace(/&#xd;?/gi, '')
        .replace(/&#xa;?/gi, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .trim();
      
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const foundEmails = toLine.match(emailRegex) || [];
      const allUsers = await db.getAllUsers();
      
      if (foundEmails.length > 0) {
        for (const emailAddr of foundEmails) {
          const matchedUser = allUsers.find(u => u.email.toLowerCase() === emailAddr.toLowerCase());
          if (matchedUser) {
            users.push({ name: matchedUser.name, email: matchedUser.email });
          }
        }
        return users;
      }
      
      const recipients = toLine.split(/[;,]/);
      
      for (const recipient of recipients) {
        let cleanRecipient = recipient.trim();
        
        if (cleanRecipient) {
          let name = '';
          let email = '';
          
          const angleMatch = cleanRecipient.match(/^(.+?)\s*<([^>]+)>/);
          if (angleMatch) {
            name = angleMatch[1].trim().replace(/^To:\s*/i, '').replace(/^To\s+/i, '');
            email = angleMatch[2].trim();
          } else {
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            const cleanEmail = cleanRecipient.replace(/>/g, '').trim();
            
            if (emailRegex.test(cleanEmail)) {
              email = cleanEmail;
              const matchedUser = allUsers.find(u => u.email.toLowerCase() === cleanEmail.toLowerCase());
              name = matchedUser ? matchedUser.name : cleanEmail;
            } else {
              const displayName = cleanRecipient.replace(/^To:\s*/i, '').replace(/^To\s+/i, '').trim();
              const matchedUser = allUsers.find(u => u.name.toLowerCase() === displayName.toLowerCase());
              
              if (matchedUser) {
                name = matchedUser.name;
                email = matchedUser.email;
              }
            }
          }
          
          if (email && email.includes('@')) {
            users.push({ name: name || email, email: email });
          }
        }
      }
    }
    
    return users;
  }

  extractEmailsFromTo(emailContent, toIndex) {
    const emails = [];
    
    // Get content after "To:"
    const afterTo = emailContent.substring(toIndex + 'to:'.length);
    
    // Find the end of the To: section (next line or next keyword)
    const lines = afterTo.split(/\n|&#xd;/i);
    let toContent = '';
    
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      let line = lines[i].trim();
      // Clean HTML entities
      line = line
        .replace(/&#xd;?/gi, '')
        .replace(/&#xa;?/gi, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .trim();
      
      // Stop if we hit another keyword section
      if (line.toLowerCase().includes(':') && i > 0) {
        break;
      }
      
      toContent += line + ' ';
    }
    
    // Extract email addresses using regex
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = toContent.match(emailRegex);
    
    if (matches) {
      emails.push(...matches);
    }
    
    logger.info('Extracted emails from To:', { 
      emailCount: emails.length,
      emails: emails
    });
    
    return emails;
  }

  // Start periodic processing
  startPeriodicProcessing(intervalMinutes = 5) {
    logger.info('Starting periodic email processing', { intervalMinutes });
    
    // Process immediately
    this.processResourceEmails();
    
    // Set up interval
    setInterval(() => {
      this.processResourceEmails();
    }, intervalMinutes * 60 * 1000);
  }
}

// Singleton instance
let emailProcessorInstance = null;

export function getEmailProcessor() {
  if (!emailProcessorInstance) {
    emailProcessorInstance = new EmailProcessor();
  }
  return emailProcessorInstance;
}