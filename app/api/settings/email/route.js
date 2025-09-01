import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';
import { validateUserSession } from '../../../../lib/auth-check';
import { SSMClient, PutParameterCommand } from '@aws-sdk/client-ssm';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

const ENV = process.env.ENVIRONMENT || 'prod';
const ssmClient = new SSMClient({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
  credentials: fromNodeProviderChain({
    timeout: 5000,
    maxRetries: 3,
  }),
});

export async function POST(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid || !validation.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { emailNotifications, smtpHost, smtpPort, smtpUser, smtpPassword } = await request.json();
    
    // Save email notification preference
    await db.saveSetting('emailNotifications', emailNotifications?.toString() || 'false');
    
    // Update SMTP settings in SSM if provided
    if (smtpHost) {
      const hostCommand = new PutParameterCommand({
        Name: ENV === 'prod' ? '/PracticeTools/SMTP_HOST' : `/PracticeTools/${ENV}/SMTP_HOST`,
        Value: smtpHost,
        Type: 'String',
        Overwrite: true
      });
      await ssmClient.send(hostCommand);
    }
    
    if (smtpPort) {
      const portCommand = new PutParameterCommand({
        Name: ENV === 'prod' ? '/PracticeTools/SMTP_PORT' : `/PracticeTools/${ENV}/SMTP_PORT`,
        Value: smtpPort,
        Type: 'String',
        Overwrite: true
      });
      await ssmClient.send(portCommand);
    }
    
    if (smtpUser) {
      const userCommand = new PutParameterCommand({
        Name: ENV === 'prod' ? '/PracticeTools/SMTP_USERNAME' : `/PracticeTools/${ENV}/SMTP_USERNAME`,
        Value: smtpUser,
        Type: 'String',
        Overwrite: true
      });
      await ssmClient.send(userCommand);
    }
    
    if (smtpPassword) {
      const passwordCommand = new PutParameterCommand({
        Name: ENV === 'prod' ? '/PracticeTools/SMTP_PW' : `/PracticeTools/${ENV}/SMTP_PW`,
        Value: smtpPassword,
        Type: 'String',
        Overwrite: true
      });
      await ssmClient.send(passwordCommand);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving email settings:', error);
    return NextResponse.json({ error: 'Failed to save email settings' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const emailNotifications = await db.getSetting('emailNotifications');
    
    return NextResponse.json({
      emailNotifications: emailNotifications === 'true',
      smtpHost: process.env.SMTP_HOST || '',
      smtpPort: process.env.SMTP_PORT || '587',
      smtpUser: process.env.SMTP_USERNAME || '',
      smtpPassword: process.env.SMTP_PW ? '••••••••' : ''
    });
  } catch (error) {
    console.error('Error loading email settings:', error);
    return NextResponse.json({ error: 'Failed to load email settings' }, { status: 500 });
  }
}