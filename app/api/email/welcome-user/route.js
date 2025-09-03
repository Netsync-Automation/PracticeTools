import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { db } from '../../../../lib/dynamodb';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { email, name, password, role, isTemporary } = await request.json();
    
    if (!email || !name || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get email settings from environment variables (loaded from SSM)
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USERNAME;
    const smtpPassword = process.env.SMTP_PW;
    const smtpPort = process.env.SMTP_PORT || '587';
    
    if (!smtpHost || !smtpUser || !smtpPassword) {
      console.error('Email settings not configured');
      return NextResponse.json({ error: 'Email settings not configured' }, { status: 500 });
    }

    // Try multiple port configurations for Exchange/OWA servers
    const portConfigs = [
      { port: parseInt(smtpPort), secure: parseInt(smtpPort) === 465, requireTLS: parseInt(smtpPort) === 587 },
      { port: 587, secure: false, requireTLS: true },
      { port: 25, secure: false, requireTLS: false },
      { port: 465, secure: true, requireTLS: false },
      { port: 2525, secure: false, requireTLS: true }
    ];
    
    let transporter = null;
    let lastError = null;
    
    for (const config of portConfigs) {
      try {
        transporter = nodemailer.createTransport({
          host: smtpHost,
          port: config.port,
          secure: config.secure,
          requireTLS: config.requireTLS,
          auth: {
            user: smtpUser,
            pass: smtpPassword
          },
          tls: {
            rejectUnauthorized: false,
            ciphers: 'SSLv3'
          },
          connectionTimeout: 15000,
          greetingTimeout: 10000,
          socketTimeout: 15000
        });
        
        await transporter.verify();
        break;
        
      } catch (error) {
        lastError = error;
        transporter = null;
      }
    }
    
    if (!transporter) {
      throw new Error(`All SMTP ports failed. Last error: ${lastError?.message}`);
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    
    // Professional email template following industry best practices
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>Welcome to Issues Tracker</title>
      <!--[if mso]>
      <noscript>
        <xml>
          <o:OfficeDocumentSettings>
            <o:PixelsPerInch>96</o:PixelsPerInch>
          </o:OfficeDocumentSettings>
        </xml>
      </noscript>
      <![endif]-->
      <style>
        * { box-sizing: border-box; }
        body, table, td, p, a, li, blockquote { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
        
        body {
          margin: 0 !important;
          padding: 0 !important;
          background-color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          font-size: 16px;
          line-height: 1.5;
          color: #1f2937;
        }
        
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
        }
        
        .header {
          padding: 48px 40px 32px;
          text-align: center;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .logo {
          font-size: 24px;
          margin-bottom: 16px;
        }
        
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
          color: #111827;
          letter-spacing: -0.025em;
        }
        
        .content {
          padding: 40px;
        }
        
        .greeting {
          margin-bottom: 32px;
        }
        
        .greeting h2 {
          margin: 0 0 16px 0;
          font-size: 20px;
          font-weight: 600;
          color: #111827;
        }
        
        .greeting p {
          margin: 0;
          color: #6b7280;
          line-height: 1.6;
        }
        
        .info-box {
          background-color: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 24px;
          margin: 32px 0;
        }
        
        .info-title {
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 600;
          color: #111827;
        }
        
        .credential-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .credential-row:last-child {
          border-bottom: none;
        }
        
        .credential-label {
          font-weight: 500;
          color: #374151;
        }
        
        .credential-value {
          font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
          background-color: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 14px;
          color: #111827;
        }
        
        .notice {
          background-color: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 16px 20px;
          margin: 24px 0;
          border-radius: 0 6px 6px 0;
        }
        
        .notice p {
          margin: 0;
          color: #92400e;
          font-size: 14px;
          line-height: 1.5;
        }
        
        .cta {
          text-align: center;
          margin: 40px 0;
        }
        
        .cta-button {
          display: inline-block;
          background-color: #111827;
          color: #ffffff !important;
          text-decoration: none;
          padding: 14px 28px;
          border-radius: 6px;
          font-weight: 500;
          font-size: 16px;
          transition: background-color 0.2s ease;
        }
        
        .cta-button:hover {
          background-color: #1f2937;
        }
        
        .features {
          margin: 40px 0 0 0;
        }
        
        .features h3 {
          margin: 0 0 20px 0;
          font-size: 18px;
          font-weight: 600;
          color: #111827;
        }
        
        .feature-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .feature-item {
          padding: 12px 0;
          border-bottom: 1px solid #f3f4f6;
        }
        
        .feature-item:last-child {
          border-bottom: none;
        }
        
        .feature-title {
          font-weight: 500;
          color: #111827;
          margin-bottom: 4px;
        }
        
        .feature-desc {
          color: #6b7280;
          font-size: 14px;
          margin: 0;
        }
        
        .footer {
          padding: 32px 40px;
          text-align: center;
          border-top: 1px solid #e5e7eb;
          background-color: #f9fafb;
        }
        
        .footer p {
          margin: 4px 0;
          color: #6b7280;
          font-size: 14px;
        }
        
        @media only screen and (max-width: 600px) {
          .content, .header, .footer {
            padding-left: 20px !important;
            padding-right: 20px !important;
          }
          
          .credential-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
          
          .credential-value {
            width: 100%;
            word-break: break-all;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <div class="logo">📋</div>
          <h1>Welcome to Issues Tracker</h1>
        </div>
        
        <div class="content">
          <div class="greeting">
            <h2>Hi ${name},</h2>
            <p>Your administrator has created an account for you in Issues Tracker. You can now log in and start collaborating with your team.</p>
          </div>

          <div class="info-box">
            <div class="info-title">Your account details</div>
            <div class="credential-row">
              <span class="credential-label">Email</span>
              <span class="credential-value">${email}</span>
            </div>
            <div class="credential-row">
              <span class="credential-label">Role</span>
              <span class="credential-value">${role.charAt(0).toUpperCase() + role.slice(1)}</span>
            </div>
            <div class="credential-row">
              <span class="credential-label">Password</span>
              <span class="credential-value">${password}</span>
            </div>
          </div>

          <div class="notice">
            <p>
              ${isTemporary ? 
                'This is a temporary password. You\'ll be required to change it when you first log in.' : 
                'This password was set by your administrator. You can change it anytime from your profile menu.'}
            </p>
          </div>

          <div class="cta">
            <a href="${baseUrl}/login" class="cta-button">Sign in to your account</a>
          </div>

          <div class="features">
            <h3>What you can do</h3>
            <ul class="feature-list">
              <li class="feature-item">
                <div class="feature-title">Report and track issues</div>
                <p class="feature-desc">Create detailed bug reports and feature requests</p>
              </li>
              <li class="feature-item">
                <div class="feature-title">Collaborate with your team</div>
                <p class="feature-desc">Comment on issues and work together to resolve problems</p>
              </li>
              <li class="feature-item">
                <div class="feature-title">Stay updated</div>
                <p class="feature-desc">Get notifications about issues you're following</p>
              </li>
              ${role === 'admin' ? `
              <li class="feature-item">
                <div class="feature-title">Manage the system</div>
                <p class="feature-desc">Access admin features and configure settings</p>
              </li>
              ` : ''}
            </ul>
          </div>
        </div>

        <div class="footer">
          <p><strong>Issues Tracker</strong></p>
          <p>© 2025 All rights reserved</p>
        </div>
      </div>
    </body>
    </html>
    `;

    const textContent = `
Welcome to Issues Tracker!

Hello ${name},

Your administrator has created an account for you in the Issues Tracker system.

Account Details:
- Email: ${email}
- Role: ${role.charAt(0).toUpperCase() + role.slice(1)}
- Temporary Password: ${password}

IMPORTANT: This is a temporary password. You will be required to change it on your first login for security purposes.

Login here: ${baseUrl}/login

What you can do:
- Create Issues: Report bugs, request features, or ask questions
- Track Progress: Follow issues and get real-time updates
- Collaborate: Comment on issues and work with your team
- Stay Informed: Receive notifications about important updates
${role === 'admin' ? '- Manage System: Access admin features and manage users' : ''}

If you have any questions or need help getting started, please contact your administrator.

© 2025 Issues Tracker. All rights reserved.
    `;

    // Send email
    await transporter.sendMail({
      from: `"Issues Tracker" <${smtpUser}>`,
      to: email,
      subject: '🎉 Welcome to Issues Tracker - Your Account is Ready!',
      text: textContent,
      html: htmlContent
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return NextResponse.json({ error: 'Failed to send welcome email' }, { status: 500 });
  }
}