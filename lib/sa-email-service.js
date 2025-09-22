import nodemailer from 'nodemailer';
import { db } from './dynamodb.js';
import { logger } from './safe-logger.js';
import { getSecureParameter } from './ssm-config.js';
import { PRACTICE_OPTIONS } from '../constants/practices.js';

class SAEmailService {
  constructor() {
    this.transporter = null;
  }

  extractSpaceUUID(webexSpaceId) {
    if (!webexSpaceId) return '';
    
    try {
      // Decode base64 to get the full Cisco Spark URI
      const decoded = Buffer.from(webexSpaceId, 'base64').toString('utf-8');
      // Extract UUID from format: ciscospark://us/ROOM/uuid
      const uuidMatch = decoded.match(/\/ROOM\/([a-f0-9-]{36})$/i);
      return uuidMatch ? uuidMatch[1] : webexSpaceId;
    } catch (error) {
      logger.error('Failed to extract space UUID', { webexSpaceId, error: error.message });
      return webexSpaceId; // Fallback to original ID
    }
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
        auth: {
          user: smtpUser || process.env.SMTP_USERNAME,
          pass: smtpPassword || process.env.SMTP_PW
        },
        tls: {
          rejectUnauthorized: false
        }
      });
    }
    return this.transporter;
  }

  async sendPendingSAAssignmentNotification(saAssignment) {
    try {
      logger.info('Sending pending SA assignment notification', { saAssignmentId: saAssignment.id });

      // Get settings for logo and app name
      let appName = await db.getSetting('app_name') || 'Practice Tools';
      if (appName === 'SVC Practice Tools') {
        appName = 'Practice Tools';
      }
      const navbarLogo = await db.getSetting('navbar_logo');
      const logoHtml = navbarLogo ? `<img src="${navbarLogo}" alt="Logo" style="height: 32px; width: auto; margin-bottom: 8px; display: block;" />` : '';

      // Get all practice ETAs for SA assignments
      const practiceETAs = {};
      for (const practice of PRACTICE_OPTIONS.filter(p => p !== 'Pending')) {
        const eta = await db.getPracticeETA(practice);
        if (eta && eta.practice_assignment_eta_hours > 0) {
          const days = eta.practice_assignment_eta_hours / 24;
          const roundedDays = Math.round(days * 100) / 100;
          practiceETAs[practice] = roundedDays.toFixed(2);
        }
      }

      // Build practice ETA table
      let practiceETATable = '';
      Object.entries(practiceETAs).forEach(([practice, days]) => {
        practiceETATable += `<tr><td style="padding: 8px 0; border-bottom: 1px solid #bfdbfe; color: #1e40af; font-weight: bold; font-family: Arial, sans-serif;">${practice}:</td><td style="padding: 8px 0; border-bottom: 1px solid #bfdbfe; color: #1e40af; font-weight: bold; text-align: right; font-family: Arial, sans-serif;">${days} days</td></tr>`;
      });

      const subject = 'SCOOP Opportunity Received - Pending Practice Assignment';
      
      const env = process.env.ENVIRONMENT || 'dev';
      const ssmPrefix = env === 'prod' ? '/PracticeTools' : `/PracticeTools/${env}`;
      const baseUrl = await getSecureParameter(`${ssmPrefix}/NEXTAUTH_URL`) || process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const saAssignmentUrl = `${baseUrl}/projects/sa-assignments/${saAssignment.id}`;
      
      const htmlBody = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>SCOOP Opportunity Received</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f7fa; line-height: 1.4; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5f7fa; padding: 20px 0; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; border: 3px solid #1e293b;">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px 30px; text-align: center;">
              <!-- Logo -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    <table border="0" cellpadding="15" cellspacing="0" style="background-color: #f8fafc; border: 2px solid #e2e8f0; mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: separate; border-radius: 8px;">
                      <tr>
                        <td align="center">
                          ${logoHtml}
                          <div style="color: #1e293b; font-size: 24px; font-weight: bold; font-family: Arial, sans-serif; line-height: 1.2;">Netsync</div>
                          <div style="color: #64748b; font-size: 12px; font-weight: normal; font-family: Arial, sans-serif; margin-top: 2px;">${appName}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <h1 style="color: #1e293b; margin: 0 0 10px 0; font-size: 28px; font-weight: bold; font-family: Arial, sans-serif; line-height: 1.2;">
                SCOOP Opportunity Received
              </h1>
              <p style="color: #64748b; margin: 0; font-size: 16px; font-family: Arial, sans-serif;">
                SA Assignment Request - ${saAssignment.customerName}
              </p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 30px;">
              
              <!-- Status Banner -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f59e0b; margin-bottom: 30px; mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: separate; border-radius: 8px;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <div style="font-size: 32px; margin-bottom: 10px; font-family: Arial, sans-serif;">⏳</div>
                    <h2 style="color: #ffffff; margin: 0 0 8px 0; font-size: 20px; font-weight: bold; font-family: Arial, sans-serif; line-height: 1.2;">
                      Pending Practice Assignment
                    </h2>
                    <p style="color: #ffffff; margin: 0; font-size: 15px; font-family: Arial, sans-serif; line-height: 1.3;">
                      Your new SCOOP opportunity has been received by the Practice Teams, but the Practices were not properly assigned. The Practice Managers will review this request and assign the appropriate Practices.
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Assignment Details Card -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; margin-bottom: 30px; mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: separate; border-radius: 8px;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 20px 0; color: #1e293b; font-size: 18px; font-weight: bold; font-family: Arial, sans-serif;">
                      📄 SCOOP Details
                    </h3>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #64748b; width: 30%; font-family: Arial, sans-serif;">Opportunity #:</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e293b; font-family: Arial, sans-serif;">${saAssignment.opportunityId || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #64748b; font-family: Arial, sans-serif;">Customer:</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e293b; font-family: Arial, sans-serif;">${saAssignment.customerName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; font-weight: bold; color: #64748b; vertical-align: top; font-family: Arial, sans-serif;">Description:</td>
                        <td style="padding: 12px 0; color: #1e293b; line-height: 1.4; font-family: Arial, sans-serif;">${saAssignment.opportunityName || 'N/A'}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Primary CTA Button -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 40px 0; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                <tr>
                  <td align="center">
                    <table border="0" cellpadding="0" cellspacing="0" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                      <tr>
                        <td style="background-color: #4f46e5; border: 3px solid #ffffff; mso-border-alt: solid #ffffff 3pt; border-collapse: separate; border-radius: 8px;">
                          <a href="${saAssignmentUrl}" style="background-color: #4f46e5; border: 3px solid #ffffff; color: #ffffff; display: inline-block; font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; line-height: 60px; text-align: center; text-decoration: none; text-transform: uppercase; width: 300px; -webkit-text-size-adjust: none; border-radius: 8px; mso-padding-alt: 0; mso-text-raise: 0;">
                            SA ASSIGNMENT DETAIL
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 15px 0 0 0; color: #64748b; font-size: 14px; font-family: Arial, sans-serif;">
                      Click above to track your request
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- ETA Information -->
              ${practiceETATable ? `
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #eff6ff; border: 1px solid #bfdbfe; margin-bottom: 30px; mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: separate; border-radius: 8px;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: #1e40af; font-size: 16px; font-weight: bold; font-family: Arial, sans-serif;">
                      ⏱️ Practice Assignment Timeline
                    </h3>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                      ${practiceETATable}
                    </table>
                  </td>
                </tr>
              </table>
              ` : `
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #eff6ff; border: 1px solid #bfdbfe; margin-bottom: 30px; mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: separate; border-radius: 8px;">
                <tr>
                  <td style="padding: 25px; text-align: center;">
                    <p style="margin: 0; color: #1e40af; font-style: italic; font-family: Arial, sans-serif;">Practice Assignment ETAs are being calculated and will be available soon.</p>
                  </td>
                </tr>
              </table>
              `}
              
              <!-- Next Steps -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: separate; border-radius: 8px;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: #166534; font-size: 16px; font-weight: bold; font-family: Arial, sans-serif;">
                      ✅ What Happens Next
                    </h3>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                      <tr><td style="padding: 5px 0; color: #166534; font-size: 14px; font-family: Arial, sans-serif;">1. Your SCOOP opportunity will be reviewed and assigned to the appropriate practice</td></tr>
                      <tr><td style="padding: 5px 0; color: #166534; font-size: 14px; font-family: Arial, sans-serif;">2. You'll receive an email notification when a practice is assigned</td></tr>
                      <tr><td style="padding: 5px 0; color: #166534; font-size: 14px; font-family: Arial, sans-serif;">3. The assigned practice will work on finding the right SA resources</td></tr>
                      <tr><td style="padding: 5px 0; color: #166534; font-size: 14px; font-family: Arial, sans-serif;">4. You'll be notified when SA resources are assigned to your opportunity</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #1e293b; padding: 30px; text-align: center;">
              <h3 style="margin: 0 0 10px 0; color: #ffffff; font-size: 20px; font-weight: 600;">Practice Tools</h3>
              <p style="margin: 0; color: #94a3b8; font-size: 14px;">Automated SA Assignment System</p>
              <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #374151;">
                <p style="margin: 0; color: #64748b; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
              </div>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      // Collect recipients
      const recipients = [];
      
      // Add AM email - use stored email or fallback to lookup
      if (saAssignment.am_email && !recipients.includes(saAssignment.am_email)) {
        recipients.push(saAssignment.am_email);
        logger.info('Added AM email to recipients', { amEmail: saAssignment.am_email });
      } else if (saAssignment.am) {
        const users = await db.getAllUsers();
        const amUser = users.find(user => user.name.toLowerCase() === saAssignment.am.toLowerCase());
        if (amUser && amUser.email && !recipients.includes(amUser.email)) {
          recipients.push(amUser.email);
          logger.info('Added AM email to recipients (fallback)', { amName: saAssignment.am, amEmail: amUser.email });
        }
      }

      // Add ISR email - use stored email or fallback to lookup
      if (saAssignment.isr_email && !recipients.includes(saAssignment.isr_email)) {
        recipients.push(saAssignment.isr_email);
        logger.info('Added ISR email to recipients', { isrEmail: saAssignment.isr_email });
      } else if (saAssignment.isr) {
        // Check if ISR field contains email in format "Name <email>" or just "email"
        const emailMatch = saAssignment.isr.match(/<([^>]+)>/) || saAssignment.isr.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
        if (emailMatch) {
          const email = emailMatch[1] || emailMatch[0];
          if (!recipients.includes(email)) {
            recipients.push(email);
            logger.info('Added ISR email to recipients (extracted)', { isrField: saAssignment.isr, extractedEmail: email });
          }
        } else {
          const users = await db.getAllUsers();
          const isrUser = users.find(user => user.name.toLowerCase() === saAssignment.isr.toLowerCase());
          if (isrUser && isrUser.email && !recipients.includes(isrUser.email)) {
            recipients.push(isrUser.email);
            logger.info('Added ISR email to recipients (fallback)', { isrName: saAssignment.isr, isrEmail: isrUser.email });
          }
        }
      }

      // Add Submitted By email - use stored email or fallback to lookup
      if (saAssignment.submitted_by_email && !recipients.includes(saAssignment.submitted_by_email)) {
        recipients.push(saAssignment.submitted_by_email);
        logger.info('Added Submitted By email to recipients', { submittedByEmail: saAssignment.submitted_by_email });
      } else if (saAssignment.submittedBy) {
        // Check if submittedBy field contains email in format "Name <email>" or just "email"
        const emailMatch = saAssignment.submittedBy.match(/<([^>]+)>/) || saAssignment.submittedBy.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
        if (emailMatch) {
          const email = emailMatch[1] || emailMatch[0];
          if (!recipients.includes(email)) {
            recipients.push(email);
            logger.info('Added Submitted By email to recipients (extracted)', { submittedByField: saAssignment.submittedBy, extractedEmail: email });
          }
        } else {
          const users = await db.getAllUsers();
          const submittedByUser = users.find(user => user.name.toLowerCase() === saAssignment.submittedBy.toLowerCase());
          if (submittedByUser && submittedByUser.email && !recipients.includes(submittedByUser.email)) {
            recipients.push(submittedByUser.email);
            logger.info('Added Submitted By email to recipients (fallback)', { submittedByName: saAssignment.submittedBy, submittedByEmail: submittedByUser.email });
          }
        }
      }

      // Add notification users
      const notificationUsers = JSON.parse(saAssignment.sa_assignment_notification_users || '[]');
      logger.info('Processing notification users', { 
        notificationUsersCount: notificationUsers.length,
        notificationUsers: notificationUsers 
      });
      
      notificationUsers.forEach(user => {
        if (user.email && !recipients.includes(user.email)) {
          recipients.push(user.email);
          logger.info('Added notification user to recipients', { userEmail: user.email, userName: user.name });
        }
      });

      logger.info('Final recipients list', { 
        recipients: recipients,
        recipientCount: recipients.length 
      });

      if (recipients.length === 0) {
        logger.warn('No recipients found for pending SA assignment notification', { saAssignmentId: saAssignment.id });
        return false;
      }

      const transporter = await this.getTransporter();
      
      // Get SMTP username for from field
      const smtpUser = await getSecureParameter(`${ssmPrefix}/SMTP_USERNAME`);
      
      logger.info('Attempting to send email', {
        from: smtpUser || process.env.SMTP_USERNAME,
        to: recipients.join(', '),
        subject: subject
      });
      
      await transporter.sendMail({
        from: `"${appName}" <${smtpUser || process.env.SMTP_USERNAME}>`,
        to: recipients.join(', '),
        subject: subject,
        html: htmlBody
      });

      logger.info('Pending SA assignment notification sent successfully', { 
        saAssignmentId: saAssignment.id,
        recipients: recipients,
        recipientCount: recipients.length 
      });

      return true;
    } catch (error) {
      logger.error('Failed to send pending SA assignment notification', { 
        error: error.message,
        errorCode: error.code,
        errorCommand: error.command,
        errorResponse: error.response,
        errorResponseCode: error.responseCode,
        saAssignmentId: saAssignment.id,
        stack: error.stack
      });
      return false;
    }
  }

  async sendPracticeAssignedNotification(saAssignment) {
    try {
      logger.info('Sending SA practice assigned notification', { saAssignmentId: saAssignment.id });

      let appName = await db.getSetting('app_name') || 'Practice Tools';
      if (appName === 'SVC Practice Tools') {
        appName = 'Practice Tools';
      }
      const navbarLogo = await db.getSetting('navbar_logo');
      const logoHtml = navbarLogo ? `<img src="${navbarLogo}" alt="Logo" style="height: 32px; width: auto; margin-bottom: 8px; display: block;" />` : '';

      const assignedPractices = saAssignment.practice ? saAssignment.practice.split(',').map(p => p.trim()) : [];
      const practiceNames = assignedPractices.join(', ');
      
      // Get resource assignment ETAs for assigned practices
      const practiceETAs = {};
      for (const practice of assignedPractices) {
        const eta = await db.getPracticeETA(practice);
        if (eta && eta.resource_assignment_eta_hours >= 0) {
          const days = eta.resource_assignment_eta_hours / 24;
          const roundedDays = Math.round(days * 100) / 100;
          practiceETAs[practice] = roundedDays.toFixed(2);
        }
      }

      // Build practice ETA table
      let practiceETATable = '';
      Object.entries(practiceETAs).forEach(([practice, days]) => {
        practiceETATable += `<tr><td style="padding: 8px 0; border-bottom: 1px solid #fcd34d; color: #92400e; font-weight: bold; font-family: Arial, sans-serif;">${practice}:</td><td style="padding: 8px 0; border-bottom: 1px solid #fcd34d; color: #92400e; font-weight: bold; text-align: right; font-family: Arial, sans-serif;">${days} days</td></tr>`;
      });
      
      const subject = 'SCOOP Opportunity Assigned to Practice';
      
      const env = process.env.ENVIRONMENT || 'dev';
      const ssmPrefix = env === 'prod' ? '/PracticeTools' : `/PracticeTools/${env}`;
      const baseUrl = await getSecureParameter(`${ssmPrefix}/NEXTAUTH_URL`) || process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const saAssignmentUrl = `${baseUrl}/projects/sa-assignments/${saAssignment.id}`;
      
      const htmlBody = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-2" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Practice Assigned to Your SCOOP</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f7fa; line-height: 1.4;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5f7fa; padding: 20px 0; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; border: 3px solid #1e293b;">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px 30px; text-align: center;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    <table border="0" cellpadding="15" cellspacing="0" style="background-color: #f8fafc; border: 2px solid #e2e8f0; mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: separate; border-radius: 8px;">
                      <tr>
                        <td align="center">
                          ${logoHtml}
                          <div style="color: #1e293b; font-size: 24px; font-weight: bold; font-family: Arial, sans-serif; line-height: 1.2;">Netsync</div>
                          <div style="color: #64748b; font-size: 12px; font-weight: normal; font-family: Arial, sans-serif; margin-top: 2px;">${appName}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <h1 style="color: #1e293b; margin: 0 0 10px 0; font-size: 28px; font-weight: bold; font-family: Arial, sans-serif; line-height: 1.2;">
                Practice Assigned
              </h1>
              <p style="color: #64748b; margin: 0; font-size: 16px; font-family: Arial, sans-serif;">
                SCOOP Opportunity - ${saAssignment.customerName}
              </p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 30px;">
              
              <!-- Status Banner -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(90deg, #10b981 0%, #059669 100%); border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <div style="font-size: 40px; margin-bottom: 10px;">🎯</div>
                    <h2 style="color: #ffffff; margin: 0 0 5px 0; font-size: 20px; font-weight: 600;">
                      Assigned to ${practiceNames} Practice
                    </h2>
                    <p style="color: rgba(255,255,255,0.95); margin: 0; font-size: 16px;">
                      Your SCOOP opportunity is now being handled by the practice team who will work on SA assignment
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Assignment Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 20px 0; color: #1e293b; font-size: 18px; font-weight: 600;">
                      📄 SCOOP Details
                    </h3>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 500; color: #64748b; width: 30%;">Opportunity #:</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b;">${saAssignment.opportunityId || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 500; color: #64748b;">Customer:</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b;">${saAssignment.customerName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 500; color: #64748b;">Assigned Practice:</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #10b981;">${practiceNames}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; font-weight: 500; color: #64748b; vertical-align: top;">Description:</td>
                        <td style="padding: 12px 0; color: #1e293b; line-height: 1.6;">${saAssignment.opportunityName || 'N/A'}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Primary CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 40px 0;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background: linear-gradient(135deg, #059669 0%, #047857 100%); border-radius: 12px; box-shadow: 0 8px 25px rgba(5, 150, 105, 0.4); border: 3px solid #ffffff;">
                          <a href="${saAssignmentUrl}" style="background-color: #059669; border: 3px solid #ffffff; color: #ffffff; display: inline-block; font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; line-height: 60px; text-align: center; text-decoration: none; text-transform: uppercase; width: 300px; border-radius: 8px;">
                            SA ASSIGNMENT DETAIL
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 15px 0 0 0; color: #64748b; font-size: 14px;">
                      Click above to track your request
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- ETA Information -->
              ${practiceETATable ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 12px; border: 1px solid #fcd34d; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: #92400e; font-size: 16px; font-weight: 600;">
                      ⏰ SA Resource Assignment Timeline
                    </h3>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      ${practiceETATable}
                    </table>
                  </td>
                </tr>
              </table>
              ` : `
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 12px; border: 1px solid #fcd34d; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px; text-align: center;">
                    <p style="margin: 0; color: #92400e; font-style: italic;">SA Resource Assignment ETAs are being calculated and will be available soon.</p>
                  </td>
                </tr>
              </table>
              `}
              
              <!-- Next Steps -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: separate; border-radius: 8px;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: #166534; font-size: 16px; font-weight: bold; font-family: Arial, sans-serif;">
                      ✅ What Happens Next
                    </h3>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                      <tr><td style="padding: 5px 0; color: #166534; font-size: 14px; font-family: Arial, sans-serif;">1. The assigned practice will work on finding the right SA resources for your opportunity</td></tr>
                      <tr><td style="padding: 5px 0; color: #166534; font-size: 14px; font-family: Arial, sans-serif;">2. You'll receive an email notification when SA resources are assigned</td></tr>
                      <tr><td style="padding: 5px 0; color: #166534; font-size: 14px; font-family: Arial, sans-serif;">3. A Webex collaboration space will be created for all stakeholders</td></tr>
                      <tr><td style="padding: 5px 0; color: #166534; font-size: 14px; font-family: Arial, sans-serif;">4. You can track progress and communicate with the team through the collaboration space</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #1e293b; padding: 30px; text-align: center;">
              <h3 style="margin: 0 0 10px 0; color: #ffffff; font-size: 20px; font-weight: 600;">Practice Tools</h3>
              <p style="margin: 0; color: #94a3b8; font-size: 14px;">Automated SA Assignment System</p>
              <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #374151;">
                <p style="margin: 0; color: #64748b; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
              </div>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      // Collect recipients
      const recipients = [];
      
      // Add AM email - use stored email or fallback to lookup
      if (saAssignment.am_email && !recipients.includes(saAssignment.am_email)) {
        recipients.push(saAssignment.am_email);
        logger.info('Added AM email to recipients', { amEmail: saAssignment.am_email });
      } else if (saAssignment.am) {
        const users = await db.getAllUsers();
        const amUser = users.find(user => user.name.toLowerCase() === saAssignment.am.toLowerCase());
        if (amUser && amUser.email && !recipients.includes(amUser.email)) {
          recipients.push(amUser.email);
          logger.info('Added AM email to recipients (fallback)', { amName: saAssignment.am, amEmail: amUser.email });
        } else {
          logger.warn('AM user not found or no email', { amName: saAssignment.am });
        }
      } else {
        logger.info('No AM specified', { am: saAssignment.am, am_email: saAssignment.am_email });
      }
      
      // Add ISR email - use stored email or fallback to lookup
      if (saAssignment.isr_email && !recipients.includes(saAssignment.isr_email)) {
        recipients.push(saAssignment.isr_email);
        logger.info('Added ISR email to recipients', { isrEmail: saAssignment.isr_email });
      } else if (saAssignment.isr) {
        // Check if ISR field contains email in format "Name <email>" or just "email"
        const emailMatch = saAssignment.isr.match(/<([^>]+)>/) || saAssignment.isr.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
        if (emailMatch) {
          const email = emailMatch[1] || emailMatch[0];
          if (!recipients.includes(email)) {
            recipients.push(email);
            logger.info('Added ISR email to recipients (extracted)', { isrField: saAssignment.isr, extractedEmail: email });
          }
        } else {
          // Fallback to user lookup by name
          const users = await db.getAllUsers();
          const isrUser = users.find(user => user.name.toLowerCase() === saAssignment.isr.toLowerCase());
          if (isrUser && isrUser.email && !recipients.includes(isrUser.email)) {
            recipients.push(isrUser.email);
            logger.info('Added ISR email to recipients (fallback)', { isrName: saAssignment.isr, isrEmail: isrUser.email });
          } else {
            logger.warn('ISR user not found or no email', { isrName: saAssignment.isr });
          }
        }
      } else {
        logger.info('No ISR specified', { isr: saAssignment.isr, isr_email: saAssignment.isr_email });
      }
      
      // Add Submitted By email - use stored email or fallback to lookup
      if (saAssignment.submitted_by_email && !recipients.includes(saAssignment.submitted_by_email)) {
        recipients.push(saAssignment.submitted_by_email);
        logger.info('Added Submitted By email to recipients', { submittedByEmail: saAssignment.submitted_by_email });
      } else if (saAssignment.submittedBy) {
        // Check if submittedBy field contains email in format "Name <email>" or just "email"
        const emailMatch = saAssignment.submittedBy.match(/<([^>]+)>/) || saAssignment.submittedBy.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
        if (emailMatch) {
          const email = emailMatch[1] || emailMatch[0];
          if (!recipients.includes(email)) {
            recipients.push(email);
            logger.info('Added Submitted By email to recipients (extracted)', { submittedByField: saAssignment.submittedBy, extractedEmail: email });
          }
        } else {
          // Fallback to user lookup by name
          const users = await db.getAllUsers();
          const submittedByUser = users.find(user => user.name.toLowerCase() === saAssignment.submittedBy.toLowerCase());
          if (submittedByUser && submittedByUser.email && !recipients.includes(submittedByUser.email)) {
            recipients.push(submittedByUser.email);
            logger.info('Added Submitted By email to recipients (fallback)', { submittedByName: saAssignment.submittedBy, submittedByEmail: submittedByUser.email });
          } else {
            logger.warn('Submitted By user not found or no email', { submittedByName: saAssignment.submittedBy });
          }
        }
      } else {
        logger.info('No Submitted By specified', { submittedBy: saAssignment.submittedBy, submitted_by_email: saAssignment.submitted_by_email });
      }

      // Add practice managers for assigned practices
      const users = await db.getAllUsers();
      for (const practice of assignedPractices) {
        const practiceLeaders = users.filter(user => 
          (user.role === 'practice_manager' || user.role === 'practice_principal') &&
          user.practices && user.practices.includes(practice)
        );
        
        practiceLeaders.forEach(user => {
          if (user.email && !recipients.includes(user.email)) {
            recipients.push(user.email);
          }
        });
      }

      if (recipients.length === 0) {
        logger.warn('No recipients found for SA practice assigned notification', { saAssignmentId: saAssignment.id });
        return false;
      }

      const transporter = await this.getTransporter();
      const smtpUser = await getSecureParameter(`${ssmPrefix}/SMTP_USERNAME`);
      
      await transporter.sendMail({
        from: `"${appName}" <${smtpUser || process.env.SMTP_USERNAME}>`,
        to: recipients.join(', '),
        subject: subject,
        html: htmlBody
      });

      logger.info('SA practice assigned notification sent successfully', { 
        saAssignmentId: saAssignment.id,
        recipients: recipients,
        recipientCount: recipients.length 
      });

      return true;
    } catch (error) {
      logger.error('Failed to send SA practice assigned notification', { 
        error: error.message,
        saAssignmentId: saAssignment.id,
        stack: error.stack
      });
      return false;
    }
  }

  async sendSAAssignedNotification(saAssignment) {
    try {
      logger.info('Sending SA assigned notification', { saAssignmentId: saAssignment.id });

      let appName = await db.getSetting('app_name') || 'Practice Tools';
      if (appName === 'SVC Practice Tools') {
        appName = 'Practice Tools';
      }
      const navbarLogo = await db.getSetting('navbar_logo');
      const logoHtml = navbarLogo ? `<img src="${navbarLogo}" alt="Logo" style="height: 32px; width: auto; margin-bottom: 8px; display: block;" />` : '';

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
          assignedSAs = Array.from(allSAs);
        } catch (e) {
          logger.error('Error parsing practiceAssignments', { error: e.message });
        }
      }
      // Fallback to legacy saAssigned field
      if (assignedSAs.length === 0 && saAssignment.saAssigned) {
        assignedSAs = saAssignment.saAssigned.split(',').map(r => r.trim());
      }
      const practiceNames = assignedPractices.join(', ');
      const saNames = assignedSAs.map(sa => sa.replace(/<[^>]+>/g, '').trim()).join(', ');
      
      // Build practice-specific SA assignment table
      let practiceAssignmentTable = '';
      if (Object.keys(practiceAssignments).length > 0) {
        Object.entries(practiceAssignments).forEach(([practice, saList]) => {
          if (Array.isArray(saList) && saList.length > 0) {
            const friendlyNames = saList.map(sa => sa.replace(/<[^>]+>/g, '').trim());
            practiceAssignmentTable += `
              <tr>
                <td style="padding: 12px 16px; border: 1px solid #e2e8f0; background-color: #f8fafc; color: #1e293b; font-weight: bold; vertical-align: top;">${practice}</td>
                <td style="padding: 12px 16px; border: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 18px; vertical-align: middle;">→</td>
                <td style="padding: 12px 16px; border: 1px solid #e2e8f0; color: #16a34a; font-weight: 600;">
                  ${friendlyNames.map(name => `<div style="display: inline-block; background-color: #dcfce7; color: #166534; padding: 4px 12px; margin: 2px 4px 2px 0; border-radius: 20px; font-size: 14px; font-weight: 600;">${name}</div>`).join('')}
                </td>
              </tr>
            `;
          }
        });
      }

      const subject = 'SA Resources Assigned to Your SCOOP Opportunity';
      
      const env = process.env.ENVIRONMENT || 'dev';
      const ssmPrefix = env === 'prod' ? '/PracticeTools' : `/PracticeTools/${env}`;
      const baseUrl = await getSecureParameter(`${ssmPrefix}/NEXTAUTH_URL`) || process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const saAssignmentUrl = `${baseUrl}/projects/sa-assignments/${saAssignment.id}`;
      
      const htmlBody = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>SA Resources Assigned to Your SCOOP</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f7fa; line-height: 1.4;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5f7fa; padding: 20px 0; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; border: 3px solid #1e293b;">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px 30px; text-align: center;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    <table border="0" cellpadding="15" cellspacing="0" style="background-color: #f8fafc; border: 2px solid #e2e8f0; mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: separate; border-radius: 8px;">
                      <tr>
                        <td align="center">
                          ${logoHtml}
                          <div style="color: #1e293b; font-size: 24px; font-weight: bold; font-family: Arial, sans-serif; line-height: 1.2;">Netsync</div>
                          <div style="color: #64748b; font-size: 12px; font-weight: normal; font-family: Arial, sans-serif; margin-top: 2px;">${appName}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <h1 style="color: #1e293b; margin: 0 0 10px 0; font-size: 28px; font-weight: bold; font-family: Arial, sans-serif; line-height: 1.2;">
                SA Resources Assigned
              </h1>
              <p style="color: #64748b; margin: 0; font-size: 16px; font-family: Arial, sans-serif;">
                SCOOP Opportunity - ${saAssignment.customerName}
              </p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 30px;">
              
              <!-- Status Banner -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(90deg, #16a34a 0%, #15803d 100%); border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <div style="font-size: 40px; margin-bottom: 10px;">🎉</div>
                    <h2 style="color: #ffffff; margin: 0 0 5px 0; font-size: 20px; font-weight: 600;">
                      SA Resources Successfully Assigned
                    </h2>
                    <p style="color: rgba(255,255,255,0.95); margin: 0; font-size: 16px;">
                      ${saNames} ${assignedSAs.length > 1 ? 'have' : 'has'} been assigned to your SCOOP opportunity
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Assignment Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 20px 0; color: #1e293b; font-size: 18px; font-weight: 600;">
                      📋 SCOOP Details
                    </h3>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 500; color: #64748b; width: 30%;">Opportunity #:</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b;">${saAssignment.opportunityId || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 500; color: #64748b;">Customer:</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b;">${saAssignment.customerName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 500; color: #64748b;">Practice:</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b;">${practiceNames}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 500; color: #64748b;">SA Resources:</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #16a34a;">${saNames}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; font-weight: 500; color: #64748b; vertical-align: top;">Description:</td>
                        <td style="padding: 12px 0; color: #1e293b; line-height: 1.6;">${saAssignment.opportunityName || 'N/A'}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Practice-Specific SA Assignments -->
              ${practiceAssignmentTable ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 20px 0; color: #1e293b; font-size: 18px; font-weight: 600;">
                      🎯 Practice-Specific SA Assignments
                    </h3>
                    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                      <thead>
                        <tr style="background-color: #f1f5f9;">
                          <th style="padding: 12px 16px; border: 1px solid #e2e8f0; text-align: left; color: #475569; font-weight: bold; font-size: 14px;">Practice</th>
                          <th style="padding: 12px 16px; border: 1px solid #e2e8f0; text-align: center; color: #475569; font-weight: bold; font-size: 14px; width: 60px;"></th>
                          <th style="padding: 12px 16px; border: 1px solid #e2e8f0; text-align: left; color: #475569; font-weight: bold; font-size: 14px;">Assigned SA Resources</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${practiceAssignmentTable}
                      </tbody>
                    </table>
                  </td>
                </tr>
              </table>
              ` : ''}
              
              <!-- Primary CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 40px 0;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); border-radius: 12px; box-shadow: 0 8px 25px rgba(22, 163, 74, 0.4); border: 3px solid #ffffff;">
                          <a href="${saAssignmentUrl}" style="background-color: #16a34a; border: 3px solid #ffffff; color: #ffffff; display: inline-block; font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; line-height: 60px; text-align: center; text-decoration: none; text-transform: uppercase; width: 300px; border-radius: 8px;">
                            SA ASSIGNMENT DETAIL
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 15px 0 0 0; color: #64748b; font-size: 14px;">
                      Click above to track your request
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Next Steps with Webex Space -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: separate; border-radius: 8px;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: #166534; font-size: 16px; font-weight: bold; font-family: Arial, sans-serif;">
                      ✅ What Happens Next
                    </h3>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                      <tr><td style="padding: 5px 0; color: #166534; font-size: 14px; font-family: Arial, sans-serif;">1. Your SA resources will begin working on your SCOOP opportunity</td></tr>
                      <tr><td style="padding: 5px 0; color: #166534; font-size: 14px; font-family: Arial, sans-serif;">2. A Webex collaboration space has been created: <strong>${saAssignment.opportunityId || 'N/A'}-${saAssignment.customerName}-${saAssignment.opportunityName || 'SA Assignment'}</strong></td></tr>
                      <tr><td style="padding: 5px 0; color: #166534; font-size: 14px; font-family: Arial, sans-serif;">3. <a href="webexteams://im?space=${this.extractSpaceUUID(saAssignment.webex_space_id) || ''}" style="color: #166534; text-decoration: underline;">Click here to join the Webex space</a> for real-time collaboration</td></tr>
                      <tr><td style="padding: 5px 0; color: #166534; font-size: 14px; font-family: Arial, sans-serif;">4. All stakeholders have been added to facilitate seamless communication</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #1e293b; padding: 30px; text-align: center;">
              <h3 style="margin: 0 0 10px 0; color: #ffffff; font-size: 20px; font-weight: 600;">Practice Tools</h3>
              <p style="margin: 0; color: #94a3b8; font-size: 14px;">Automated SA Assignment System</p>
              <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #374151;">
                <p style="margin: 0; color: #64748b; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
              </div>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      // Collect recipients
      const recipients = [];
      
      // Get all users to look up emails
      const users = await db.getAllUsers();
      
      // Add AM email - use stored email or fallback to lookup
      if (saAssignment.am_email) {
        recipients.push(saAssignment.am_email);
        logger.info('Added AM email to recipients', { amEmail: saAssignment.am_email });
      } else if (saAssignment.am) {
        const amUser = users.find(user => user.name.toLowerCase() === saAssignment.am.toLowerCase());
        if (amUser && amUser.email) {
          recipients.push(amUser.email);
          logger.info('Added AM email to recipients (fallback)', { amName: saAssignment.am, amEmail: amUser.email });
        } else {
          logger.warn('AM user not found or no email', { amName: saAssignment.am });
        }
      } else {
        logger.info('No AM specified', { am: saAssignment.am, am_email: saAssignment.am_email });
      }
      
      // Add ISR email - use stored email or fallback to lookup
      if (saAssignment.isr_email) {
        recipients.push(saAssignment.isr_email);
        logger.info('Added ISR email to recipients', { isrEmail: saAssignment.isr_email });
      } else if (saAssignment.isr) {
        // Check if ISR field contains email in format "Name <email>" or just "email"
        const emailMatch = saAssignment.isr.match(/<([^>]+)>/) || saAssignment.isr.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
        if (emailMatch) {
          const email = emailMatch[1] || emailMatch[0];
          recipients.push(email);
          logger.info('Added ISR email to recipients (extracted)', { isrField: saAssignment.isr, extractedEmail: email });
        } else {
          const isrUser = users.find(user => user.name.toLowerCase() === saAssignment.isr.toLowerCase());
          if (isrUser && isrUser.email) {
            recipients.push(isrUser.email);
            logger.info('Added ISR email to recipients (fallback)', { isrName: saAssignment.isr, isrEmail: isrUser.email });
          } else {
            logger.warn('ISR user not found or no email', { isrName: saAssignment.isr });
          }
        }
      } else {
        logger.info('No ISR specified', { isr: saAssignment.isr, isr_email: saAssignment.isr_email });
      }
      
      // Add Submitted By email - use stored email or fallback to lookup
      if (saAssignment.submitted_by_email) {
        recipients.push(saAssignment.submitted_by_email);
        logger.info('Added Submitted By email to recipients', { submittedByEmail: saAssignment.submitted_by_email });
      } else if (saAssignment.submittedBy) {
        // Check if submittedBy field contains email in format "Name <email>" or just "email"
        const emailMatch = saAssignment.submittedBy.match(/<([^>]+)>/) || saAssignment.submittedBy.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
        if (emailMatch) {
          const email = emailMatch[1] || emailMatch[0];
          recipients.push(email);
          logger.info('Added Submitted By email to recipients (extracted)', { submittedByField: saAssignment.submittedBy, extractedEmail: email });
        } else {
          const submittedByUser = users.find(user => user.name.toLowerCase() === saAssignment.submittedBy.toLowerCase());
          if (submittedByUser && submittedByUser.email) {
            recipients.push(submittedByUser.email);
            logger.info('Added Submitted By email to recipients (fallback)', { submittedByName: saAssignment.submittedBy, submittedByEmail: submittedByUser.email });
          } else {
            logger.warn('Submitted By user not found or no email', { submittedByName: saAssignment.submittedBy });
          }
        }
      } else {
        logger.info('No Submitted By specified', { submittedBy: saAssignment.submittedBy, submitted_by_email: saAssignment.submitted_by_email });
      }

      // Add assigned SAs (get their emails from users table)
      assignedSAs.forEach(saWithEmail => {
        // Extract email from "Name <email>" format or use name lookup
        const emailMatch = saWithEmail.match(/<([^>]+)>/);
        if (emailMatch) {
          const email = emailMatch[1];
          if (!recipients.includes(email)) {
            recipients.push(email);
          }
        } else {
          const user = users.find(u => u.name.toLowerCase() === saWithEmail.toLowerCase());
          if (user && user.email && !recipients.includes(user.email)) {
            recipients.push(user.email);
          }
        }
      });

      // Add practice managers and principals for assigned practices
      for (const practice of assignedPractices) {
        const practiceLeaders = users.filter(user => 
          (user.role === 'practice_manager' || user.role === 'practice_principal') &&
          user.practices && user.practices.includes(practice)
        );
        
        practiceLeaders.forEach(user => {
          if (user.email && !recipients.includes(user.email)) {
            recipients.push(user.email);
          }
        });
      }

      if (recipients.length === 0) {
        logger.warn('No recipients found for SA assigned notification', { saAssignmentId: saAssignment.id });
        return false;
      }

      const transporter = await this.getTransporter();
      const smtpUser = await getSecureParameter(`${ssmPrefix}/SMTP_USERNAME`);
      
      await transporter.sendMail({
        from: `"${appName}" <${smtpUser || process.env.SMTP_USERNAME}>`,
        to: recipients.join(', '),
        subject: subject,
        html: htmlBody
      });

      logger.info('SA assigned notification sent successfully', { 
        saAssignmentId: saAssignment.id,
        recipients: recipients,
        recipientCount: recipients.length 
      });

      return true;
    } catch (error) {
      logger.error('Failed to send SA assigned notification', { 
        error: error.message,
        saAssignmentId: saAssignment.id,
        stack: error.stack
      });
      return false;
    }
  }

  async sendSACompletionNotification(saAssignment) {
    try {
      logger.info('Sending SA completion notification', { saAssignmentId: saAssignment.id });

      let appName = await db.getSetting('app_name') || 'Practice Tools';
      if (appName === 'SVC Practice Tools') {
        appName = 'Practice Tools';
      }
      const navbarLogo = await db.getSetting('navbar_logo');
      const logoHtml = navbarLogo ? `<img src="${navbarLogo}" alt="Logo" style="height: 32px; width: auto; margin-bottom: 8px; display: block;" />` : '';

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
      const practiceNames = assignedPractices.join(', ');
      const saNames = assignedSAs.map(sa => sa.replace(/<[^>]+>/g, '').trim()).join(', ');
      const completedBy = saAssignment.completedBy || 'SA Team';

      // Build practice-SA status display
      const allUsers = await db.getAllUsers();
      const saCompletions = JSON.parse(saAssignment.saCompletions || '{}');
      const practiceList = saAssignment.practice ? saAssignment.practice.split(',').map(p => p.trim()) : [];
      const saList = assignedSAs;
      
      let practiceStatusHtml = '';
      practiceList.forEach(practice => {
        const assignedSAs = saList.filter(saName => {
          const user = allUsers.find(u => u.name === saName);
          return user && user.practices && user.practices.includes(practice);
        });
        
        const practiceComplete = assignedSAs.length > 0 && assignedSAs.every(sa => saCompletions[sa]);
        
        assignedSAs.forEach(sa => {
          const saComplete = !!saCompletions[sa];
          practiceStatusHtml += `
            <tr>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: ${practiceComplete ? '#f0fff4' : '#fef5e7'}; color: ${practiceComplete ? '#22543d' : '#c05621'}; font-weight: bold;">${practice}</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; text-align: center;">→</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: ${saComplete ? '#f0fff4' : '#fef5e7'}; color: ${saComplete ? '#22543d' : '#c05621'}; font-weight: bold;">${sa}</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; text-align: right; color: ${saComplete ? '#22543d' : '#c05621'}; font-weight: bold;">${saComplete ? '✅ Complete' : '🔄 In Progress'}</td>
            </tr>
          `;
        });
      });
      
      const subject = 'SA Assignment Complete - All SA Resources Finished';
      
      const env = process.env.ENVIRONMENT || 'dev';
      const ssmPrefix = env === 'prod' ? '/PracticeTools' : `/PracticeTools/${env}`;
      const baseUrl = await getSecureParameter(`${ssmPrefix}/NEXTAUTH_URL`) || process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const saAssignmentUrl = `${baseUrl}/projects/sa-assignments/${saAssignment.id}`;
      
      const htmlBody = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>SA Assignment Completed</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f7fa; line-height: 1.4;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5f7fa; padding: 20px 0; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; border: 3px solid #1e293b;">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px 30px; text-align: center;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    <table border="0" cellpadding="15" cellspacing="0" style="background-color: #f8fafc; border: 2px solid #e2e8f0; mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: separate; border-radius: 8px;">
                      <tr>
                        <td align="center">
                          ${logoHtml}
                          <div style="color: #1e293b; font-size: 24px; font-weight: bold; font-family: Arial, sans-serif; line-height: 1.2;">Netsync</div>
                          <div style="color: #64748b; font-size: 12px; font-weight: normal; font-family: Arial, sans-serif; margin-top: 2px;">${appName}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <h1 style="color: #1e293b; margin: 0 0 10px 0; font-size: 28px; font-weight: bold; font-family: Arial, sans-serif; line-height: 1.2;">
                SA Assignment Completed
              </h1>
              <p style="color: #64748b; margin: 0; font-size: 16px; font-family: Arial, sans-serif;">
                SCOOP Opportunity - ${saAssignment.customerName}
              </p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 30px;">
              
              <!-- Status Banner -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%); border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <div style="font-size: 40px; margin-bottom: 10px;">🏁</div>
                    <h2 style="color: #ffffff; margin: 0 0 5px 0; font-size: 20px; font-weight: 600;">
                      SA Assignment Successfully Completed
                    </h2>
                    <p style="color: rgba(255,255,255,0.95); margin: 0; font-size: 16px;">
                      Completed by ${completedBy} on ${new Date(saAssignment.completedAt || new Date()).toLocaleDateString()}
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Assignment Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 20px 0; color: #1e293b; font-size: 18px; font-weight: 600;">
                      📋 SCOOP Details
                    </h3>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 500; color: #64748b; width: 30%;">Opportunity #:</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b;">${saAssignment.opportunityId || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 500; color: #64748b;">Customer:</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b;">${saAssignment.customerName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 500; color: #64748b;">Practice:</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b;">${practiceNames}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 500; color: #64748b;">SA Resources:</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #2563eb;">${saNames}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; font-weight: 500; color: #64748b; vertical-align: top;">Description:</td>
                        <td style="padding: 12px 0; color: #1e293b; line-height: 1.6;">${saAssignment.opportunityName || 'N/A'}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Primary CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 40px 0;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border-radius: 12px; box-shadow: 0 8px 25px rgba(37, 99, 235, 0.4); border: 3px solid #ffffff;">
                          <a href="${saAssignmentUrl}" style="background-color: #2563eb; border: 3px solid #ffffff; color: #ffffff; display: inline-block; font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; line-height: 60px; text-align: center; text-decoration: none; text-transform: uppercase; width: 300px; border-radius: 8px;">
                            VIEW ASSIGNMENT DETAILS
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 15px 0 0 0; color: #64748b; font-size: 14px;">
                      Click above to view the completed assignment
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Practice & SA Status Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="color: #2d3748; margin: 0 0 15px 0; font-size: 18px;">Practice & SA Status</h3>
                    <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0;">
                      <thead>
                        <tr style="background: #edf2f7;">
                          <th style="padding: 10px 12px; border: 1px solid #e2e8f0; text-align: left; color: #4a5568; font-weight: bold;">Practice</th>
                          <th style="padding: 10px 12px; border: 1px solid #e2e8f0; text-align: center; color: #4a5568; font-weight: bold;"></th>
                          <th style="padding: 10px 12px; border: 1px solid #e2e8f0; text-align: left; color: #4a5568; font-weight: bold;">SA Resource</th>
                          <th style="padding: 10px 12px; border: 1px solid #e2e8f0; text-align: right; color: #4a5568; font-weight: bold;">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${practiceStatusHtml}
                      </tbody>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Completion Summary -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f0f9ff; border: 1px solid #bae6fd; mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: separate; border-radius: 8px;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: #0c4a6e; font-size: 16px; font-weight: bold; font-family: Arial, sans-serif;">
                      ✅ Assignment Summary
                    </h3>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                      <tr><td style="padding: 5px 0; color: #0c4a6e; font-size: 14px; font-family: Arial, sans-serif;">• All SA resources have completed their work on this SCOOP opportunity</td></tr>
                      <tr><td style="padding: 5px 0; color: #0c4a6e; font-size: 14px; font-family: Arial, sans-serif;">• All deliverables and requirements have been fulfilled</td></tr>
                      <tr><td style="padding: 5px 0; color: #0c4a6e; font-size: 14px; font-family: Arial, sans-serif;">• The Webex collaboration space remains available for future reference</td></tr>
                      <tr><td style="padding: 5px 0; color: #0c4a6e; font-size: 14px; font-family: Arial, sans-serif;">• The Technical Editing team will engage to make the documents customer ready</td></tr>
                      <tr><td style="padding: 5px 0; color: #0c4a6e; font-size: 14px; font-family: Arial, sans-serif;">• Once the Technical Editing team is complete, you may access your completed and edited SoW and Quote to send to your customer</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #1e293b; padding: 30px; text-align: center;">
              <h3 style="margin: 0 0 10px 0; color: #ffffff; font-size: 20px; font-weight: 600;">Practice Tools</h3>
              <p style="margin: 0; color: #94a3b8; font-size: 14px;">Automated SA Assignment System</p>
              <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #374151;">
                <p style="margin: 0; color: #64748b; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
              </div>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      // Collect recipients
      const recipients = [];
      
      // Use already fetched users for email lookup
      const users = allUsers;
      
      // Add AM email - use stored email or fallback to lookup
      if (saAssignment.am_email && !recipients.includes(saAssignment.am_email)) {
        recipients.push(saAssignment.am_email);
        logger.info('Added AM email to recipients', { amEmail: saAssignment.am_email });
      } else if (saAssignment.am) {
        const amUser = users.find(user => user.name.toLowerCase() === saAssignment.am.toLowerCase());
        if (amUser && amUser.email && !recipients.includes(amUser.email)) {
          recipients.push(amUser.email);
          logger.info('Added AM email to recipients (fallback)', { amName: saAssignment.am, amEmail: amUser.email });
        }
      }
      
      // Add ISR email - use stored email or fallback to lookup
      if (saAssignment.isr_email && !recipients.includes(saAssignment.isr_email)) {
        recipients.push(saAssignment.isr_email);
        logger.info('Added ISR email to recipients', { isrEmail: saAssignment.isr_email });
      } else if (saAssignment.isr) {
        const emailMatch = saAssignment.isr.match(/<([^>]+)>/) || saAssignment.isr.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
        if (emailMatch) {
          const email = emailMatch[1] || emailMatch[0];
          if (!recipients.includes(email)) {
            recipients.push(email);
            logger.info('Added ISR email to recipients (extracted)', { isrField: saAssignment.isr, extractedEmail: email });
          }
        } else {
          const isrUser = users.find(user => user.name.toLowerCase() === saAssignment.isr.toLowerCase());
          if (isrUser && isrUser.email && !recipients.includes(isrUser.email)) {
            recipients.push(isrUser.email);
            logger.info('Added ISR email to recipients (fallback)', { isrName: saAssignment.isr, isrEmail: isrUser.email });
          }
        }
      }
      
      // Add Submitted By email - use stored email or fallback to lookup
      if (saAssignment.submitted_by_email && !recipients.includes(saAssignment.submitted_by_email)) {
        recipients.push(saAssignment.submitted_by_email);
        logger.info('Added Submitted By email to recipients', { submittedByEmail: saAssignment.submitted_by_email });
      } else if (saAssignment.submittedBy) {
        const emailMatch = saAssignment.submittedBy.match(/<([^>]+)>/) || saAssignment.submittedBy.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
        if (emailMatch) {
          const email = emailMatch[1] || emailMatch[0];
          if (!recipients.includes(email)) {
            recipients.push(email);
            logger.info('Added Submitted By email to recipients (extracted)', { submittedByField: saAssignment.submittedBy, extractedEmail: email });
          }
        } else {
          const submittedByUser = users.find(user => user.name.toLowerCase() === saAssignment.submittedBy.toLowerCase());
          if (submittedByUser && submittedByUser.email && !recipients.includes(submittedByUser.email)) {
            recipients.push(submittedByUser.email);
            logger.info('Added Submitted By email to recipients (fallback)', { submittedByName: saAssignment.submittedBy, submittedByEmail: submittedByUser.email });
          }
        }
      }

      // Add assigned SAs
      assignedSAs.forEach(saWithEmail => {
        // Extract email from "Name <email>" format or use name lookup
        const emailMatch = saWithEmail.match(/<([^>]+)>/);
        if (emailMatch) {
          const email = emailMatch[1];
          if (!recipients.includes(email)) {
            recipients.push(email);
          }
        } else {
          const user = users.find(u => u.name.toLowerCase() === saWithEmail.toLowerCase());
          if (user && user.email && !recipients.includes(user.email)) {
            recipients.push(user.email);
          }
        }
      });

      // Add practice managers and principals for assigned practices
      for (const practice of assignedPractices) {
        const practiceLeaders = users.filter(user => 
          (user.role === 'practice_manager' || user.role === 'practice_principal') &&
          user.practices && user.practices.includes(practice)
        );
        
        practiceLeaders.forEach(user => {
          if (user.email && !recipients.includes(user.email)) {
            recipients.push(user.email);
          }
        });
      }

      if (recipients.length === 0) {
        logger.warn('No recipients found for SA completion notification', { saAssignmentId: saAssignment.id });
        return false;
      }

      const transporter = await this.getTransporter();
      const smtpUser = await getSecureParameter(`${ssmPrefix}/SMTP_USERNAME`);
      
      await transporter.sendMail({
        from: `"${appName}" <${smtpUser || process.env.SMTP_USERNAME}>`,
        to: recipients.join(', '),
        subject: subject,
        html: htmlBody
      });

      logger.info('SA completion notification sent successfully', { 
        saAssignmentId: saAssignment.id,
        recipients: recipients,
        recipientCount: recipients.length 
      });

      return true;
    } catch (error) {
      logger.error('Failed to send SA completion notification', { 
        error: error.message,
        saAssignmentId: saAssignment.id,
        stack: error.stack
      });
      return false;
    }
  }
}

export const saEmailService = new SAEmailService();