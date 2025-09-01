import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request) {
  try {
    const { testEmail, appName } = await request.json();
    
    if (!testEmail) {
      return NextResponse.json({ error: 'Test email address is required' }, { status: 400 });
    }
    
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USERNAME;
    const smtpPassword = process.env.SMTP_PW;
    const smtpPort = process.env.SMTP_PORT || '587';
    
    if (!smtpHost || !smtpUser || !smtpPassword) {
      return NextResponse.json({ error: 'SMTP configuration not found. Please configure SMTP settings first.' }, { status: 400 });
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
    
    // Test email content
    const mailOptions = {
      from: `"${appName || 'Issue Tracker'}" <${smtpUser}>`,
      to: testEmail,
      subject: `Test Email from ${appName || 'Issue Tracker'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Email Configuration Test</h2>
          <p>This is a test email from <strong>${appName || 'Issue Tracker'}</strong>.</p>
          <p>If you received this email, your SMTP configuration is working correctly!</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 14px;">
            Sent at: ${new Date().toLocaleString()}<br>
            From: ${appName || 'Issue Tracker'}
          </p>
        </div>
      `
    };
    
    // Send email
    await transporter.sendMail(mailOptions);
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Test email error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to send test email' 
    }, { status: 500 });
  }
}