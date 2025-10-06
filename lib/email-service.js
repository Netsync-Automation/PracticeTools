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

  async sendPendingAssignmentNotification(assignment) {
    try {
      logger.info('Sending pending assignment notification', { assignmentId: assignment.id });
      
      // DSR: Ensure all email fields are populated (backwards compatibility)
      const { AssignmentEmailProcessor } = await import('./assignment-email-processor.js');
      assignment = await AssignmentEmailProcessor.processAssignmentEmails(assignment);

      // Get settings for logo and app name
      let appName = await db.getSetting('app_name') || 'Practice Tools';
      // Ensure consistent app name for emails
      if (appName === 'SVC Practice Tools') {
        appName = 'Practice Tools';
      }
      const navbarLogo = await db.getSetting('navbar_logo');
      const logoHtml = navbarLogo ? `<img src="${navbarLogo}" alt="Logo" style="height: 32px; width: auto; margin-bottom: 8px; display: block;" />` : '';

      // Get all practice ETAs
      const practiceETAs = {};
      for (const practice of PRACTICE_OPTIONS.filter(p => p !== 'Pending')) {
        try {
          // Fetch ETA data from practice-etas API
          const response = await fetch(`/api/practice-etas?practice=${encodeURIComponent(practice)}`);
          const data = await response.json();
          
          if (data.success && data.etas && data.etas.length > 0) {
            // Find practice assignment ETA
            const practiceETA = data.etas.find(eta => eta.statusTransition === 'pending_to_unassigned');
            if (practiceETA && practiceETA.avgDurationHours > 0) {
              const days = practiceETA.avgDurationHours / 24; // Convert to days
              const roundedDays = Math.round(days * 100) / 100; // Round to 2 decimal places
              practiceETAs[practice] = roundedDays.toFixed(2);
            }
          }
        } catch (etaError) {
          console.error(`Failed to get ETA for practice ${practice}:`, etaError);
        }
      }

      // Build practice ETA table
      let practiceETATable = '';
      Object.entries(practiceETAs).forEach(([practice, days]) => {
        practiceETATable += `<tr><td style="padding: 8px 0; border-bottom: 1px solid #bfdbfe; color: #1e40af; font-weight: bold; font-family: Arial, sans-serif;">${practice}:</td><td style="padding: 8px 0; border-bottom: 1px solid #bfdbfe; color: #1e40af; font-weight: bold; text-align: right; font-family: Arial, sans-serif;">${days} days</td></tr>`;
      });

      const subject = 'Resource Request Received - Pending Practice Assignment';
      
      const env = process.env.ENVIRONMENT || 'dev';
      const ssmPrefix = env === 'prod' ? '/PracticeTools' : `/PracticeTools/${env}`;
      const baseUrl = await getSecureParameter(`${ssmPrefix}/NEXTAUTH_URL`) || process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const assignmentUrl = `${baseUrl}/projects/resource-assignments/${assignment.id}`;
      
      const htmlBody = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Resource Request Received</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
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
                Resource Request Received
              </h1>
              <p style="color: #64748b; margin: 0; font-size: 16px; font-family: Arial, sans-serif;">
                Resource Assignment Request - ${assignment.customerName}
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
                      Your request is being reviewed and will be assigned to the appropriate practice team
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Assignment Details Card -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; margin-bottom: 30px; mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: separate; border-radius: 8px;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 20px 0; color: #1e293b; font-size: 18px; font-weight: bold; font-family: Arial, sans-serif;">
                      📄 Assignment Details
                    </h3>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #64748b; width: 30%; font-family: Arial, sans-serif;">Project #:</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e293b; font-family: Arial, sans-serif;">${assignment.projectNumber}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #64748b; font-family: Arial, sans-serif;">Customer:</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e293b; font-family: Arial, sans-serif;">${assignment.customerName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; font-weight: bold; color: #64748b; vertical-align: top; font-family: Arial, sans-serif;">Description:</td>
                        <td style="padding: 12px 0; color: #1e293b; line-height: 1.4; font-family: Arial, sans-serif;">${assignment.projectDescription}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Primary CTA Button -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 30px 0; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                <tr>
                  <td align="center">
                    <table border="0" cellpadding="0" cellspacing="0" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                      <tr>
                        <td style="background-color: #4f46e5; border: 3px solid #ffffff; mso-border-alt: solid #ffffff 3pt; border-collapse: separate; border-radius: 8px;">
                          <!--[if mso]>
                          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${assignmentUrl}" style="height:60px;v-text-anchor:middle;width:300px;" arcsize="13%" stroke="f" fillcolor="#4f46e5">
                          <w:anchorlock/>
                          <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:18px;font-weight:bold;text-transform:uppercase;">VIEW YOUR REQUEST</center>
                          </v:roundrect>
                          <![endif]-->
                          <!--[if !mso]><!-->
                          <a href="${assignmentUrl}" style="background-color: #4f46e5; border: 3px solid #ffffff; color: #ffffff; display: inline-block; font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; line-height: 60px; text-align: center; text-decoration: none; text-transform: uppercase; width: 300px; -webkit-text-size-adjust: none; mso-hide: all; border-radius: 8px;">
                            VIEW YOUR REQUEST
                          </a>
                          <!--<![endif]-->
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 15px 0 0 0; color: #64748b; font-size: 14px; font-family: Arial, sans-serif;">
                      Click above to track progress and chat with practice leaders
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
                      <tr><td style="padding: 5px 0; color: #166534; font-size: 14px; font-family: Arial, sans-serif;">1. Your request will be reviewed and assigned to the appropriate practice</td></tr>
                      <tr><td style="padding: 5px 0; color: #166534; font-size: 14px; font-family: Arial, sans-serif;">2. You'll receive an email notification when a practice is assigned</td></tr>
                      <tr><td style="padding: 5px 0; color: #166534; font-size: 14px; font-family: Arial, sans-serif;">3. The assigned practice will work on finding the right resources</td></tr>
                      <tr><td style="padding: 5px 0; color: #166534; font-size: 14px; font-family: Arial, sans-serif;">4. You'll be notified when resources are assigned to your project</td></tr>
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
              <p style="margin: 0; color: #94a3b8; font-size: 14px;">Automated Resource Management System</p>
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
      
      // Get SMTP username for from field
      const smtpUser = await getSecureParameter(`${ssmPrefix}/SMTP_USERNAME`);
      
      logger.info('Attempting to send email', {
        from: smtpUser || process.env.SMTP_USERNAME,
        to: recipients.join(', '),
        subject: subject,
        smtpHost: process.env.SMTP_HOST,
        smtpPort: process.env.SMTP_PORT
      });
      
      await transporter.sendMail({
        from: `"${appName}" <${smtpUser || process.env.SMTP_USERNAME}>`,
        to: recipients.join(', '),
        subject: subject,
        html: htmlBody
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
      
      // DSR: Ensure all email fields are populated (backwards compatibility)
      const { AssignmentEmailProcessor } = await import('./assignment-email-processor.js');
      assignment = await AssignmentEmailProcessor.processAssignmentEmails(assignment);

      // Get settings for logo and app name
      let appName = await db.getSetting('app_name') || 'Practice Tools';
      console.log('📧 [EMAIL-SERVICE] Raw app name from DB:', appName);
      // Ensure consistent app name for emails
      if (appName === 'SVC Practice Tools') {
        appName = 'Practice Tools';
        console.log('📧 [EMAIL-SERVICE] Normalized app name:', appName);
      }
      console.log('📧 [EMAIL-SERVICE] Final app name for email:', appName);
      const navbarLogo = await db.getSetting('navbar_logo');
      const logoHtml = navbarLogo ? `<img src="${navbarLogo}" alt="Logo" style="height: 32px; width: auto; margin-bottom: 8px; display: block;" />` : '';

      // Get practice ETAs for assigned practices
      const assignedPractices = assignment.practice ? assignment.practice.split(',').map(p => p.trim()) : [];
      const practiceETAs = {};
      
      for (const practice of assignedPractices) {
        try {
          // Fetch ETA data from practice-etas API
          const response = await fetch(`/api/practice-etas?practice=${encodeURIComponent(practice)}`);
          const data = await response.json();
          
          if (data.success && data.etas && data.etas.length > 0) {
            // Find resource assignment ETA
            const resourceETA = data.etas.find(eta => eta.statusTransition === 'unassigned_to_assigned');
            if (resourceETA && resourceETA.avgDurationHours > 0) {
              const days = resourceETA.avgDurationHours / 24; // Convert to days
              const roundedDays = Math.round(days * 100) / 100; // Round to 2 decimal places
              practiceETAs[practice] = roundedDays.toFixed(2);
            }
          }
        } catch (etaError) {
          console.error(`Failed to get ETA for practice ${practice}:`, etaError);
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
      
      const htmlBody = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Practice Assigned to Your Request</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f7fa; line-height: 1.4;">
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
                Practice Assigned
              </h1>
              <p style="color: #64748b; margin: 0; font-size: 16px; font-family: Arial, sans-serif;">
                Resource Assignment Request - ${assignment.customerName}
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
                      Your request is now being handled by the practice team who will work on resource assignment
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Assignment Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 20px 0; color: #1e293b; font-size: 18px; font-weight: 600;">
                      📄 Assignment Details
                    </h3>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 500; color: #64748b; width: 30%;">Project #:</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b;">${assignment.projectNumber}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 500; color: #64748b;">Customer:</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b;">${assignment.customerName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; font-weight: 500; color: #64748b; vertical-align: top;">Description:</td>
                        <td style="padding: 12px 0; color: #1e293b; line-height: 1.6;">${assignment.projectDescription}</td>
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
                          <!--[if mso]>
                          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${assignmentUrl}" style="height:60px;v-text-anchor:middle;width:300px;" arcsize="13%" stroke="f" fillcolor="#059669">
                          <w:anchorlock/>
                          <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:18px;font-weight:bold;text-transform:uppercase;">CHAT WITH ${practiceNames.toUpperCase()}</center>
                          </v:roundrect>
                          <![endif]-->
                          <!--[if !mso]><!-->
                          <a href="${assignmentUrl}" style="background-color: #059669; border: 3px solid #ffffff; color: #ffffff; display: inline-block; font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; line-height: 60px; text-align: center; text-decoration: none; text-transform: uppercase; width: 300px; border-radius: 8px;">
                            CHAT WITH ${practiceNames.toUpperCase()}
                          </a>
                          <!--<![endif]-->
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 15px 0 0 0; color: #64748b; font-size: 14px;">
                      Click above to discuss your request with the assigned practice leaders
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- ETA Information -->
              ${practiceETAList ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 12px; border: 1px solid #fcd34d; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: #92400e; font-size: 16px; font-weight: 600;">
                      ⏰ Resource Assignment Timeline
                    </h3>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      ${practiceETAList.split('\n').map(line => line.trim()).filter(line => line).map(line => {
                        const parts = line.split(':');
                        const practice = parts[0];
                        const daysText = parts[1] ? parts[1].trim() : '';
                        return `<tr>
                          <td style="padding: 8px 0; border-bottom: 1px solid #fcd34d; color: #92400e; font-weight: 500;">${practice}:</td>
                          <td style="padding: 8px 0; border-bottom: 1px solid #fcd34d; color: #92400e; font-weight: 600; text-align: right;">${daysText}</td>
                        </tr>`;
                      }).join('')}
                    </table>
                  </td>
                </tr>
              </table>
              ` : `
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 12px; border: 1px solid #fcd34d; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px; text-align: center;">
                    <p style="margin: 0; color: #92400e; font-style: italic;">Resource Assignment ETAs are being calculated and will be available soon.</p>
                  </td>
                </tr>
              </table>
              `}
              
              <!-- Next Steps -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 12px; border: 1px solid #bbf7d0;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: #166534; font-size: 16px; font-weight: 600;">
                      📋 What Happens Next
                    </h3>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="padding: 5px 0; color: #166534; font-size: 14px;">1. The ${practiceNames} practice team will review your resource requirements</td></tr>
                      <tr><td style="padding: 5px 0; color: #166534; font-size: 14px;">2. They will identify and assign the most suitable resources for your project</td></tr>
                      <tr><td style="padding: 5px 0; color: #166534; font-size: 14px;">3. You'll receive an email notification when resources are assigned</td></tr>
                      <tr><td style="padding: 5px 0; color: #166534; font-size: 14px;">4. The assigned resources will be ready to start work on your project</td></tr>
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
              <p style="margin: 0; color: #94a3b8; font-size: 14px;">Automated Resource Management System</p>
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
        from: `"${appName}" <${smtpUser || process.env.SMTP_USERNAME}>`,
        to: recipients.join(', '),
        subject: subject,
        html: htmlBody
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

  async sendResourceAssignedNotification(assignment) {
    try {
      logger.info('Sending resource assigned notification', { assignmentId: assignment.id });
      
      // DSR: Ensure all email fields are populated (backwards compatibility)
      const { AssignmentEmailProcessor } = await import('./assignment-email-processor.js');
      assignment = await AssignmentEmailProcessor.processAssignmentEmails(assignment);

      // Get settings for logo and app name
      let appName = await db.getSetting('app_name') || 'Practice Tools';
      // Ensure consistent app name for emails
      if (appName === 'SVC Practice Tools') {
        appName = 'Practice Tools';
      }
      console.log('📧 [EMAIL-SERVICE] App name from DB:', appName);
      const navbarLogo = await db.getSetting('navbar_logo');
      const logoHtml = navbarLogo ? `<img src="${navbarLogo}" alt="Logo" style="height: 32px; width: auto; margin-bottom: 8px; display: block;" />` : '';

      const assignedPractices = assignment.practice ? assignment.practice.split(',').map(p => p.trim()) : [];
      const assignedResources = assignment.resourceAssigned ? assignment.resourceAssigned.split(',').map(r => r.trim()) : [];
      const practiceNames = assignedPractices.join(', ');
      const resourceNames = assignedResources.join(', ');

      const subject = 'Resources Assigned to Your Project';
      
      // Get base URL from SSM
      const env = process.env.ENVIRONMENT || 'dev';
      const ssmPrefix = env === 'prod' ? '/PracticeTools' : `/PracticeTools/${env}`;
      const baseUrl = await getSecureParameter(`${ssmPrefix}/NEXTAUTH_URL`) || process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const assignmentUrl = `${baseUrl}/projects/resource-assignments/${assignment.id}`;
      
      const htmlBody = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Resources Assigned to Your Project</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f7fa; line-height: 1.4;">
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
                Resources Assigned
              </h1>
              <p style="color: #64748b; margin: 0; font-size: 16px; font-family: Arial, sans-serif;">
                Resource Assignment Request - ${assignment.customerName}
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
                      Resources Successfully Assigned
                    </h2>
                    <p style="color: rgba(255,255,255,0.95); margin: 0; font-size: 16px;">
                      ${resourceNames} ${assignedResources.length > 1 ? 'have' : 'has'} been assigned to your project
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Assignment Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 20px 0; color: #1e293b; font-size: 18px; font-weight: 600;">
                      📋 Project Details
                    </h3>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 500; color: #64748b; width: 30%;">Project #:</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b;">${assignment.projectNumber}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 500; color: #64748b;">Customer:</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b;">${assignment.customerName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 500; color: #64748b;">Practice:</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b;">${practiceNames}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 500; color: #64748b;">Resources:</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #16a34a;">${resourceNames}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; font-weight: 500; color: #64748b; vertical-align: top;">Description:</td>
                        <td style="padding: 12px 0; color: #1e293b; line-height: 1.6;">${assignment.projectDescription}</td>
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
                        <td style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); border-radius: 12px; box-shadow: 0 8px 25px rgba(22, 163, 74, 0.4); border: 3px solid #ffffff;">
                          <!--[if mso]>
                          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${assignmentUrl}" style="height:60px;v-text-anchor:middle;width:300px;" arcsize="13%" stroke="f" fillcolor="#16a34a">
                          <w:anchorlock/>
                          <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:18px;font-weight:bold;text-transform:uppercase;">START COLLABORATION</center>
                          </v:roundrect>
                          <![endif]-->
                          <!--[if !mso]><!-->
                          <a href="${assignmentUrl}" style="background-color: #16a34a; border: 3px solid #ffffff; color: #ffffff; display: inline-block; font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; line-height: 60px; text-align: center; text-decoration: none; text-transform: uppercase; width: 300px; border-radius: 8px;">
                            START COLLABORATION
                          </a>
                          <!--<![endif]-->
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 15px 0 0 0; color: #64748b; font-size: 14px;">
                      Click above to access your project workspace and collaborate with your team
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Next Steps -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 12px; border: 1px solid #bbf7d0;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: #166534; font-size: 16px; font-weight: 600;">
                      🎯 Ready to Get Started
                    </h3>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="padding: 5px 0; color: #166534; font-size: 14px;">1. Your assigned resources are ready to begin work on your project</td></tr>
                      <tr><td style="padding: 5px 0; color: #166534; font-size: 14px;">2. A Webex collaboration space has been created for your project team</td></tr>
                      <tr><td style="padding: 5px 0; color: #166534; font-size: 14px;">3. Use the link above to access project details and team communication</td></tr>
                      <tr><td style="padding: 5px 0; color: #166534; font-size: 14px;">4. Coordinate with your team to kick off the project successfully</td></tr>
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
              <p style="margin: 0; color: #94a3b8; font-size: 14px;">Automated Resource Management System</p>
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
      
      // Add Account Manager email if available (DSR compliance)
      if (assignment.am_email) {
        recipients.push(assignment.am_email);
        logger.info('Added AM email to recipients', { amEmail: assignment.am_email });
      }
      
      // Add PM email if available
      if (assignment.pm_email) {
        recipients.push(assignment.pm_email);
        logger.info('Added PM email to recipients', { pmEmail: assignment.pm_email });
      }
      
      // DSR: Add all assigned resources' emails (not just the first one)
      const assignedResources = assignment.resourceAssigned ? assignment.resourceAssigned.split(',').map(r => r.trim()) : [];
      assignedResources.forEach(resourceName => {
        // Extract email from "Name <email>" format or find by name
        const emailMatch = resourceName.match(/<([^>]+)>/);
        if (emailMatch) {
          const email = emailMatch[1];
          if (!recipients.includes(email)) {
            recipients.push(email);
            logger.info('Added resource email to recipients (from format)', { resourceName, email });
          }
        } else {
          // Fallback: find user by name
          const user = users.find(u => u.name.toLowerCase() === resourceName.toLowerCase());
          if (user && user.email && !recipients.includes(user.email)) {
            recipients.push(user.email);
            logger.info('Added resource email to recipients (by lookup)', { resourceName, email: user.email });
          }
        }
      });
      
      // Keep legacy field for backwards compatibility
      if (assignment.resource_assigned_email && !recipients.includes(assignment.resource_assigned_email)) {
        recipients.push(assignment.resource_assigned_email);
        logger.info('Added legacy resource assigned email to recipients', { resourceEmail: assignment.resource_assigned_email });
      }
      
      // Add notification users (DSR compliance)
      const notificationUsers = JSON.parse(assignment.resource_assignment_notification_users || '[]');
      logger.info('Processing notification users for resource assigned', { 
        notificationUsersCount: notificationUsers.length,
        notificationUsers: notificationUsers 
      });
      
      notificationUsers.forEach(user => {
        if (user.email && !recipients.includes(user.email)) {
          recipients.push(user.email);
          logger.info('Added notification user to recipients', { userEmail: user.email, userName: user.name });
        }
      });

      // Get users for practice leader lookup
      const users = await db.getAllUsers();

      // Add practice managers and principals for assigned practices
      for (const practice of assignedPractices) {
        const practiceLeaders = users.filter(user => 
          (user.role === 'practice_manager' || user.role === 'practice_principal') &&
          user.practices && user.practices.includes(practice)
        );
        
        practiceLeaders.forEach(user => {
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
        logger.warn('No recipients found for resource assigned notification', { assignmentId: assignment.id });
        return false;
      }

      const transporter = await this.getTransporter();
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

      logger.info('Resource assigned notification sent successfully', { 
        assignmentId: assignment.id,
        recipients: recipients,
        recipientCount: recipients.length 
      });

      return true;
    } catch (error) {
      logger.error('Failed to send resource assigned notification', { 
        error: error.message,
        assignmentId: assignment.id,
        stack: error.stack
      });
      return false;
    }
  }

  async sendPasswordResetEmail(userName, userEmail, newPassword) {
    try {
      const appName = await db.getSetting('app_name') || 'Practice Tools';
      const navbarLogo = await db.getSetting('navbar_logo');
      const logoHtml = navbarLogo ? `<img src="${navbarLogo}" alt="Logo" style="height: 32px; width: auto; margin-bottom: 8px; display: block;" />` : '';
      
      const env = process.env.ENVIRONMENT || 'dev';
      const ssmPrefix = env === 'prod' ? '/PracticeTools' : `/PracticeTools/${env}`;
      const baseUrl = await getSecureParameter(`${ssmPrefix}/NEXTAUTH_URL`) || process.env.NEXTAUTH_URL || 'http://localhost:3000';
      
      const subject = 'Your Password Has Been Reset';
      
      const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Password Reset</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f7fa;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f7fa; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 3px solid #1e293b; border-radius: 8px;">
          <tr>
            <td style="padding: 40px 30px; text-align: center;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    <table cellpadding="15" cellspacing="0" style="background-color: #f8fafc; border: 2px solid #e2e8f0; border-radius: 8px;">
                      <tr>
                        <td align="center">
                          ${logoHtml}
                          <div style="color: #1e293b; font-size: 24px; font-weight: bold;">Netsync</div>
                          <div style="color: #64748b; font-size: 12px; margin-top: 2px;">${appName}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <h1 style="color: #1e293b; margin: 0 0 10px 0; font-size: 28px; font-weight: bold;">Password Reset</h1>
              <p style="color: #64748b; margin: 0; font-size: 16px;">Your password has been reset</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #dbeafe; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <div style="font-size: 32px; margin-bottom: 10px;">🔑</div>
                    <h2 style="color: #1e40af; margin: 0 0 8px 0; font-size: 20px; font-weight: bold;">New Password Generated</h2>
                    <p style="color: #1e40af; margin: 0; font-size: 15px;">Your password has been reset. Please use the temporary password below to log in.</p>
                  </td>
                </tr>
              </table>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 16px; font-weight: bold;">Your New Password</h3>
                    <div style="background-color: #ffffff; border: 2px solid #e2e8f0; border-radius: 6px; padding: 15px; font-family: monospace; font-size: 18px; font-weight: bold; color: #1e293b; text-align: center; letter-spacing: 1px;">
                      ${newPassword}
                    </div>
                    <p style="margin: 15px 0 0 0; color: #64748b; font-size: 14px; text-align: center;">Copy this password exactly as shown</p>
                  </td>
                </tr>
              </table>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${baseUrl}/login" style="background-color: #4f46e5; color: #ffffff; display: inline-block; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; line-height: 50px; text-align: center; text-decoration: none; width: 200px; border-radius: 8px;">LOGIN NOW</a>
                  </td>
                </tr>
              </table>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="margin: 0 0 10px 0; color: #92400e; font-size: 14px; font-weight: bold;">⚠️ Important Security Notice</h3>
                    <p style="margin: 0; color: #92400e; font-size: 13px;">Please change this temporary password after logging in. Go to your profile settings to set a new password of your choice.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #1e293b; padding: 30px; text-align: center; border-radius: 0 0 8px 8px;">
              <h3 style="margin: 0 0 10px 0; color: #ffffff; font-size: 20px; font-weight: 600;">${appName}</h3>
              <p style="margin: 0; color: #94a3b8; font-size: 14px;">Secure User Management</p>
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
      
      const transporter = await this.getTransporter();
      const smtpUser = await getSecureParameter(`${ssmPrefix}/SMTP_USERNAME`);
      
      await transporter.sendMail({
        from: `"${appName}" <${smtpUser || process.env.SMTP_USERNAME}>`,
        to: userEmail,
        subject: subject,
        html: htmlBody
      });
      
      logger.info('Password reset email sent successfully', { userEmail, userName });
      return true;
    } catch (error) {
      logger.error('Failed to send password reset email', { error: error.message, userEmail, userName });
      return false;
    }
  }
}

export const emailService = new EmailService();