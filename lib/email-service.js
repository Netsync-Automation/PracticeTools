import nodemailer from 'nodemailer';
import { db } from './dynamodb.js';
import { logger } from './safe-logger.js';
import { PRACTICE_OPTIONS } from '../constants/practices.js';
import { getSecureParameter } from './ssm-config.js';

class EmailService {
  constructor() {
    this.transporter = null;
  }

  async getTransporter() {
    if (!this.transporter) {
      const env = process.env.ENVIRONMENT || 'dev';
      const ssmPrefix = env === 'prod' ? '/PracticeTools' : `/PracticeTools/${env}`;
      
      const [smtpHost, smtpPort, smtpUser, smtpPassword] = await Promise.all([
        getSecureParameter(`${ssmPrefix}/SMTP_HOST`),
        getSecureParameter(`${ssmPrefix}/SMTP_PORT`),
        getSecureParameter(`${ssmPrefix}/SMTP_USERNAME`),
        getSecureParameter(`${ssmPrefix}/SMTP_PW`)
      ]);
      
      this.transporter = nodemailer.createTransport({
        host: smtpHost || process.env.SMTP_HOST,
        port: parseInt(smtpPort || process.env.SMTP_PORT || '587'),
        secure: false,
        debug: true,
        logger: true,
        auth: {
          user: smtpUser || process.env.SMTP_USERNAME,
          pass: smtpPassword || process.env.SMTP_PW
        }
      });
    }
    return this.transporter;
  }

  async sendPendingAssignmentNotification(assignment) {
    try {
      logger.info('Sending pending assignment notification', { assignmentId: assignment.id });

      // Get all practice ETAs
      const practiceETAs = {};
      for (const practice of PRACTICE_OPTIONS.filter(p => p !== 'Pending')) {
        const eta = await db.getPracticeETA(practice);
        if (eta && eta.practice_assignment_eta_hours > 0) {
          const days = Math.round(eta.practice_assignment_eta_hours * 10) / 240; // Convert to days with 1 decimal
          practiceETAs[practice] = days;
        }
      }

      // Build practice ETA table
      let practiceETATable = '';
      Object.entries(practiceETAs).forEach(([practice, days]) => {
        practiceETATable += `${practice}: ${days} days\n`;
      });

      if (!practiceETATable) {
        practiceETATable = 'Practice Assignment ETAs are being calculated and will be available soon.';
      }

      const subject = 'Resource Request Received - Pending Practice Assignment';
      
      // Get base URL from SSM
      const env = process.env.ENVIRONMENT || 'dev';
      const ssmPrefix = env === 'prod' ? '/PracticeTools' : `/PracticeTools/${env}`;
      const baseUrl = await getSecureParameter(`${ssmPrefix}/NEXTAUTH_URL`) || process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const assignmentUrl = `${baseUrl}/projects/resource-assignments/${assignment.id}`;
      
      const body = `Your resource request has been received and is being validated by the practices. Once the appropriate practice has been assigned, you will receive another email indicating the practice has been assigned and what your estimated ETA to resource assignment will be.

See below for the Practice Assignment ETA, by practice:

${practiceETATable}

Assignment Details:
- Assignment #: ${assignment.assignment_number}
- Project #: ${assignment.projectNumber}
- Customer: ${assignment.customerName}
- Description: ${assignment.projectDescription}

You will be notified when this assignment is assigned to a practice.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 VIEW YOUR RESOURCE REQUEST
${assignmentUrl}

💬 To live chat with the practices about this resource request, click the link above.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Thank you,
Practice Tools`;

      // Collect recipients
      const recipients = [];
      
      // Add PM email if available
      if (assignment.pm_email) {
        recipients.push(assignment.pm_email);
        logger.info('Added PM email to recipients', { pmEmail: assignment.pm_email });
      }

      // Add notification users
      const notificationUsers = JSON.parse(assignment.resource_assignment_notification_users || '[]');
      logger.info('Processing notification users', { 
        notificationUsersCount: notificationUsers.length,
        notificationUsers: notificationUsers 
      });
      
      notificationUsers.forEach(user => {
        if (user.email) {
          recipients.push(user.email);
          logger.info('Added notification user to recipients', { userEmail: user.email, userName: user.name });
        }
      });

      logger.info('Final recipients list', { 
        recipients: recipients,
        recipientCount: recipients.length 
      });

      if (recipients.length === 0) {
        logger.warn('No recipients found for pending assignment notification', { assignmentId: assignment.id });
        return false;
      }

      const transporter = await this.getTransporter();
      
      logger.info('Attempting to send email', {
        from: process.env.SMTP_USERNAME,
        to: recipients.join(', '),
        subject: subject,
        smtpHost: process.env.SMTP_HOST,
        smtpPort: process.env.SMTP_PORT
      });
      
      await transporter.sendMail({
        from: smtpUser || process.env.SMTP_USERNAME,
        to: recipients.join(', '),
        subject: subject,
        text: body
      });

      logger.info('Pending assignment notification sent successfully', { 
        assignmentId: assignment.id,
        recipients: recipients,
        recipientCount: recipients.length 
      });

      return true;
    } catch (error) {
      logger.error('Failed to send pending assignment notification', { 
        error: error.message,
        errorCode: error.code,
        errorCommand: error.command,
        errorResponse: error.response,
        errorResponseCode: error.responseCode,
        assignmentId: assignment.id,
        stack: error.stack
      });
      return false;
    }
  }

  async sendPracticeAssignedNotification(assignment) {
    try {
      logger.info('Sending practice assigned notification', { assignmentId: assignment.id });

      // Get practice ETAs for assigned practices
      const assignedPractices = assignment.practice ? assignment.practice.split(',').map(p => p.trim()) : [];
      const practiceETAs = {};
      
      for (const practice of assignedPractices) {
        const eta = await db.getPracticeETA(practice);
        if (eta && eta.resource_assignment_eta_hours > 0) {
          const days = Math.round(eta.resource_assignment_eta_hours * 10) / 240;
          practiceETAs[practice] = days;
        }
      }

      // Build practice ETA list
      let practiceETAList = '';
      if (Object.keys(practiceETAs).length > 0) {
        Object.entries(practiceETAs).forEach(([practice, days]) => {
          practiceETAList += `${practice}: ${days} days\n`;
        });
      } else {
        practiceETAList = 'Resource Assignment ETAs are being calculated and will be available soon.';
      }

      const practiceNames = assignedPractices.join(', ');
      const subject = 'Resource Request Assigned to Practice';
      
      // Get SSM parameters (base URL and SMTP settings)
      const env = process.env.ENVIRONMENT || 'dev';
      const ssmPrefix = env === 'prod' ? '/PracticeTools' : `/PracticeTools/${env}`;
      
      const [baseUrl, smtpHost, smtpPort, smtpUser] = await Promise.all([
        getSecureParameter(`${ssmPrefix}/NEXTAUTH_URL`),
        getSecureParameter(`${ssmPrefix}/SMTP_HOST`),
        getSecureParameter(`${ssmPrefix}/SMTP_PORT`),
        getSecureParameter(`${ssmPrefix}/SMTP_USERNAME`)
      ]);
      
      const assignmentUrl = `${baseUrl || process.env.NEXTAUTH_URL || 'http://localhost:3000'}/projects/resource-assignments/${assignment.id}`;
      
      const body = `Your resource request been assigned to the ${practiceNames} Practice(s).

The estimated time to resource assignment is listed below for the Practice(s) assigned:

${practiceETAList}
Assignment Details:

Assignment #: ${assignment.assignment_number}

Project #: ${assignment.projectNumber}

Customer: ${assignment.customerName}

Description: ${assignment.projectDescription}

You will be notified when the resource(s) are assigned to this project.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 VIEW YOUR RESOURCE REQUEST
${assignmentUrl}

💬 To live chat with the ${practiceNames} practice leaders about this resource request, click the link above.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Thank you,
Practice Tools`;

      // Collect recipients
      const recipients = [];
      
      // Add PM email if available
      if (assignment.pm_email) {
        recipients.push(assignment.pm_email);
        logger.info('Added PM email to recipients', { pmEmail: assignment.pm_email });
      }

      // Get practice managers and principals for assigned practices
      const users = await db.getAllUsers();
      for (const practice of assignedPractices) {
        const practiceManagers = users.filter(user => 
          (user.role === 'practice_manager' || user.role === 'practice_principal') &&
          user.practices && user.practices.includes(practice)
        );
        
        practiceManagers.forEach(user => {
          if (user.email && !recipients.includes(user.email)) {
            recipients.push(user.email);
            logger.info('Added practice leader to recipients', { 
              userEmail: user.email, 
              userName: user.name, 
              role: user.role,
              practice: practice 
            });
          }
        });
      }

      logger.info('Final recipients list', { 
        recipients: recipients,
        recipientCount: recipients.length 
      });

      if (recipients.length === 0) {
        logger.warn('No recipients found for practice assigned notification', { assignmentId: assignment.id });
        return false;
      }

      const transporter = await this.getTransporter();
      
      logger.info('Attempting to send email', {
        from: smtpUser || process.env.SMTP_USERNAME,
        to: recipients.join(', '),
        subject: subject,
        smtpHost: smtpHost || process.env.SMTP_HOST,
        smtpPort: smtpPort || process.env.SMTP_PORT
      });
      
      await transporter.sendMail({
        from: smtpUser || process.env.SMTP_USERNAME,
        to: recipients.join(', '),
        subject: subject,
        text: body
      });

      logger.info('Practice assigned notification sent successfully', { 
        assignmentId: assignment.id,
        recipients: recipients,
        recipientCount: recipients.length 
      });

      return true;
    } catch (error) {
      logger.error('Failed to send practice assigned notification', { 
        error: error.message,
        errorCode: error.code,
        errorCommand: error.command,
        errorResponse: error.response,
        errorResponseCode: error.responseCode,
        assignmentId: assignment.id,
        stack: error.stack
      });
      return false;
    }
  }
}

export const emailService = new EmailService();