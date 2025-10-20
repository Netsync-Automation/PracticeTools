import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getSSMParameter } from '../../../../lib/ssm-helper.js';

export async function POST(request) {
  try {
    console.log('🔧 [EMAIL-TEST] Starting email test...');
    const { testEmail, appName } = await request.json();
    console.log('📧 [EMAIL-TEST] Request data:', { testEmail, appName });
    
    if (!testEmail) {
      console.log('❌ [EMAIL-TEST] No test email provided');
      return NextResponse.json({ error: 'Test email address is required' }, { status: 400 });
    }
    
    console.log('🔍 [EMAIL-TEST] Fetching SMTP parameters from SSM...');
    const [smtpHost, smtpUser, smtpPassword, smtpPort] = await Promise.all([
      getSSMParameter('SMTP_HOST'),
      getSSMParameter('SMTP_USERNAME'),
      getSSMParameter('SMTP_PW'),
      getSSMParameter('SMTP_PORT')
    ]);
    
    const port = smtpPort || '587';
    
    console.log('⚙️ [EMAIL-TEST] SMTP Configuration:', {
      host: smtpHost,
      port: port,
      username: smtpUser,
      passwordLength: smtpPassword ? smtpPassword.length : 0,
      hasPassword: !!smtpPassword
    });
    
    if (!smtpHost || !smtpUser || !smtpPassword) {
      console.log('❌ [EMAIL-TEST] Missing SMTP configuration');
      return NextResponse.json({ error: 'SMTP configuration not found. Please configure SMTP settings first.' }, { status: 400 });
    }
    
    console.log('🔌 [EMAIL-TEST] Creating SMTP transporter...');
    const transporterConfig = {
      host: smtpHost,
      port: parseInt(port),
      secure: parseInt(port) === 465,
      requireTLS: parseInt(port) === 587,
      auth: {
        user: smtpUser,
        pass: smtpPassword
      },
      tls: {
        rejectUnauthorized: false,
        servername: smtpHost,
        secureProtocol: 'TLSv1_2_method'
      },
      connectionTimeout: 30000,
      greetingTimeout: 20000,
      socketTimeout: 30000,

    };
    
    console.log('📋 [EMAIL-TEST] Transporter config:', {
      ...transporterConfig,
      auth: { user: transporterConfig.auth.user, pass: '[REDACTED]' }
    });
    
    const transporter = nodemailer.createTransport(transporterConfig);
    
    console.log('🔍 [EMAIL-TEST] Verifying SMTP connection...');
    try {
      const verifyResult = await transporter.verify();
      console.log('✅ [EMAIL-TEST] SMTP verification successful:', verifyResult);
    } catch (verifyError) {
      console.error('❌ [EMAIL-TEST] SMTP verification failed:', {
        message: verifyError.message,
        code: verifyError.code,
        errno: verifyError.errno,
        syscall: verifyError.syscall,
        address: verifyError.address,
        port: verifyError.port,
        stack: verifyError.stack
      });
      throw verifyError;
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
    
    console.log('📤 [EMAIL-TEST] Sending test email...');
    console.log('📧 [EMAIL-TEST] Mail options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject
    });
    
    try {
      const sendResult = await transporter.sendMail(mailOptions);
      console.log('✅ [EMAIL-TEST] Email sent successfully:', {
        messageId: sendResult.messageId,
        response: sendResult.response,
        accepted: sendResult.accepted,
        rejected: sendResult.rejected
      });
      
      return NextResponse.json({ 
        success: true,
        messageId: sendResult.messageId,
        response: sendResult.response
      });
    } catch (sendError) {
      console.error('❌ [EMAIL-TEST] Email send failed:', {
        message: sendError.message,
        code: sendError.code,
        response: sendError.response,
        stack: sendError.stack
      });
      throw sendError;
    }
    
  } catch (error) {
    console.error('💥 [EMAIL-TEST] Fatal error:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      syscall: error.syscall,
      address: error.address,
      port: error.port,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      stack: error.stack
    });
    
    return NextResponse.json({ 
      error: error.message || 'Failed to send test email',
      details: {
        code: error.code,
        errno: error.errno,
        syscall: error.syscall,
        address: error.address,
        port: error.port
      }
    }, { status: 500 });
  }
}