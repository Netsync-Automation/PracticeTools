import { getEWSClient } from './ews-client.js';
import { db } from './dynamodb.js';
import { logger } from './safe-logger.js';

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
      const extractedData = this.extractDataFromEmail(email, rule.keywordMappings);
      
      // Check if ALL required keywords were found
      const requiredFields = rule.keywordMappings.length;
      const extractedFields = Object.keys(extractedData).length;
      
      if (extractedFields !== requiredFields) {
        logger.warn('Not all required keywords found in email', { 
          emailId: email.id,
          required: requiredFields,
          found: extractedFields,
          missing: rule.keywordMappings.filter(m => !extractedData[m.field]).map(m => m.keyword)
        });
        return { success: false, error: 'Missing required keywords' };
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

      logger.info('About to call db.addAssignment with parameters', {
        practice: 'Pending',
        status: 'Pending',
        projectNumber: extractedData.projectNumber || '',
        notificationUsers: extractedData.resourceAssignmentNotificationUsers || []
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
        extractedData.resourceAssignmentNotificationUsers || [] // notification users from To: field
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

  matchesRule(email, rule) {
    logger.info('Checking rule match', {
      emailFrom: email.from,
      emailSubject: email.subject,
      ruleSenderEmail: rule.senderEmail,
      ruleSubjectPattern: rule.subjectPattern,
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

    // Check subject pattern
    if (rule.subjectPattern && !email.subject.toLowerCase().includes(rule.subjectPattern.toLowerCase())) {
      logger.info('Rule failed subject pattern check', {
        ruleSubjectPattern: rule.subjectPattern,
        emailSubject: email.subject
      });
      return false;
    }

    logger.info('Rule matched successfully', { ruleName: rule.name });
    return true;
  }

  extractDataFromEmail(email, keywordMappings) {
    const extractedData = {};
    const emailContent = `${email.subject}\n${email.body}`.toLowerCase();

    for (const mapping of keywordMappings) {
      if (!mapping.keyword || !mapping.field) continue;

      const keyword = mapping.keyword.toLowerCase();
      const keywordIndex = emailContent.indexOf(keyword);

      if (keywordIndex !== -1) {
        // Special handling for "To:" keyword
        if (keyword === 'to:') {
          // Find the actual "To:" line in the forwarded email, not just any "to:"
          const forwardedToMatch = emailContent.match(/\bto:\s*([^\n]*(?:michael b\. griffin|henry pugsley)[^\n]*)/i);
          if (forwardedToMatch) {
            const toUsers = this.parseToLine(forwardedToMatch[1]);
            if (toUsers.length > 0) {
              extractedData.resourceAssignmentNotificationUsers = toUsers;
              logger.info('Extracted To: users', { 
                keyword: mapping.keyword,
                userCount: toUsers.length,
                users: toUsers,
                rawToLine: forwardedToMatch[1]
              });
            }
          }
          continue;
        }

        // Extract text after the keyword
        const afterKeyword = emailContent.substring(keywordIndex + keyword.length);
        
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

    return extractedData;
  }

  cleanDocumentationLink(link) {
    if (!link) return '';
    
    // Extract URL from text like "job documentation <https://...>"
    const urlMatch = link.match(/<(https?:\/\/[^>]+)>/);
    if (urlMatch) {
      return urlMatch[1];
    }
    
    // Return as-is if no URL pattern found
    return link;
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

  extractToUsers(emailContent, startIndex) {
    const afterKeyword = emailContent.substring(startIndex);
    const lines = afterKeyword.split(/\n|&#xd;/i);
    const users = [];
    
    // Get the first line after "To:"
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
      // Clean HTML entities
      toLine = toLine
        .replace(/&#xd;?/gi, '')
        .replace(/&#xa;?/gi, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .trim();
      
      // Split by semicolon or comma to handle multiple recipients
      const recipients = toLine.split(/[;,]/);
      
      logger.info('Debug recipients split', {
        originalLine: toLine,
        recipients: recipients,
        recipientCount: recipients.length
      });
      
      recipients.forEach((recipient, index) => {
        let cleanRecipient = recipient.trim();
        
        logger.info(`Debug recipient ${index}`, {
          original: recipient,
          cleaned: cleanRecipient
        });
        
        if (cleanRecipient) {
          // Handle format: "Name <email>" or just "email"
          let name = '';
          let email = '';
          
          // Check if it has angle brackets format
          const angleMatch = cleanRecipient.match(/^(.+?)\s*<([^>]+)>/);
          if (angleMatch) {
            name = angleMatch[1].trim();
            email = angleMatch[2].trim();
            logger.info(`Extracted from angle brackets`, { name, email });
          } else {
            // Just an email address - clean any trailing >
            email = cleanRecipient.replace(/>/g, '').trim();
            name = email; // Use email as name if no name provided
            logger.info(`Using as plain email`, { name, email });
          }
          
          if (email) {
            users.push({
              name: name || email,
              email: email
            });
          }
        }
      });
    }
    
    return users;
  }

  parseToLine(toLine) {
    const users = [];
    
    if (toLine) {
      // Clean HTML entities
      toLine = toLine
        .replace(/&#xd;?/gi, '')
        .replace(/&#xa;?/gi, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .trim();
      
      // Split by semicolon or comma to handle multiple recipients
      const recipients = toLine.split(/[;,]/);
      
      logger.info('Debug recipients split', {
        originalLine: toLine,
        recipients: recipients,
        recipientCount: recipients.length
      });
      
      recipients.forEach((recipient, index) => {
        let cleanRecipient = recipient.trim();
        
        logger.info(`Debug recipient ${index}`, {
          original: recipient,
          cleaned: cleanRecipient
        });
        
        if (cleanRecipient) {
          // Handle format: "Name <email>" or just "email"
          let name = '';
          let email = '';
          
          // Check if it has angle brackets format
          const angleMatch = cleanRecipient.match(/^(.+?)\s*<([^>]+)>/);
          if (angleMatch) {
            name = angleMatch[1].trim();
            email = angleMatch[2].trim();
            logger.info(`Extracted from angle brackets`, { name, email });
          } else {
            // Just an email address - clean any trailing >
            email = cleanRecipient.replace(/>/g, '').trim();
            name = email; // Use email as name if no name provided
            logger.info(`Using as plain email`, { name, email });
          }
          
          if (email) {
            users.push({
              name: name || email,
              email: email
            });
          }
        }
      });
    }
    
    return users;
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