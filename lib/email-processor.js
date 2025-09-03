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

      // Check if resource email processing is enabled
      const enabled = await db.getSetting('resource_email_enabled') === 'true';
      if (!enabled) {
        logger.info('Resource email processing is disabled');
        return;
      }

      // Get processing rules
      const rulesJson = await db.getSetting('resource_email_rules');
      const rules = JSON.parse(rulesJson || '[]');
      
      if (rules.length === 0) {
        logger.info('No resource email rules configured');
        return;
      }

      logger.info('Processing emails with rules', { ruleCount: rules.length });

      // Get EWS client and check for new emails
      const ewsClient = getEWSClient();
      const emails = await ewsClient.checkNewMail(this.lastProcessTime);

      logger.info('Found emails to process', { emailCount: emails.length });

      for (const email of emails) {
        await this.processEmail(email, rules);
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
        subjectPattern: matchingRule.subjectPattern 
      });

      // Log full email body to see forwarded content
      logger.info('Full email body for debugging', {
        fullEmailBody: email.body,
        bodyLength: email.body.length
      });
      
      // Extract data from email using keyword mappings
      const extractedData = this.extractDataFromEmail(email, matchingRule.keywordMappings);
      
      // Check if ALL required keywords were found
      const requiredFields = matchingRule.keywordMappings.length;
      const extractedFields = Object.keys(extractedData).length;
      
      if (extractedFields !== requiredFields) {
        logger.warn('Not all required keywords found in email', { 
          emailId: email.id,
          required: requiredFields,
          found: extractedFields,
          missing: matchingRule.keywordMappings.filter(m => !extractedData[m.field]).map(m => m.keyword)
        });
        return;
      }

      // Create resource assignment
      const resourceAssignment = {
        projectNumber: extractedData.projectNumber || '',
        clientName: extractedData.clientName || '',
        requestedBy: extractedData.requestedBy || email.from,
        skillsRequired: extractedData.skillsRequired ? [extractedData.skillsRequired] : [],
        priority: extractedData.priority || 'Medium',
        startDate: extractedData.startDate || '',
        endDate: extractedData.endDate || '',
        description: extractedData.description || email.subject,
        region: extractedData.region || '',
        documentationLink: extractedData.documentationLink || '',
        notes: extractedData.notes || '',
        status: 'Open',
        source: 'Email',
        emailId: email.id
      };

      logger.info('Creating resource assignment from email', { 
        projectNumber: resourceAssignment.projectNumber,
        clientName: resourceAssignment.clientName 
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
        [] // attachments
      );
      
      if (assignmentId) {
        logger.info('Resource assignment created successfully', { 
          assignmentId,
          emailId: email.id 
        });

        // Only mark email as read after successful assignment creation
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
        logger.error('Failed to create resource assignment - email left unread for retry', { emailId: email.id });
      }

    } catch (error) {
      logger.error('Error processing individual email', { 
        error: error.message,
        emailId: email.id 
      });
    }
  }

  matchesRule(email, rule) {
    // Check sender email
    if (rule.senderEmail && !email.from.toLowerCase().includes(rule.senderEmail.toLowerCase())) {
      return false;
    }

    // Check subject pattern
    if (rule.subjectPattern && !email.subject.toLowerCase().includes(rule.subjectPattern.toLowerCase())) {
      return false;
    }

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