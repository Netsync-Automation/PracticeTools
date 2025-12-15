import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';
import { validateUserSession } from '../../../../lib/auth-check';
import { SSMClient, PutParameterCommand, GetParameterCommand } from '@aws-sdk/client-ssm';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';


export const dynamic = 'force-dynamic';
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
    
    console.log('[EMAIL-SETTINGS] Saving settings:', {
      emailNotifications,
      smtpHost,
      smtpPort,
      smtpUser,
      hasPassword: !!smtpPassword,
      passwordLength: smtpPassword?.length || 0
    });
    
    // Get environment for database operations
    const environment = process.env.ENVIRONMENT || 'dev';
    
    // Save email notification preference
    await db.saveSetting('emailNotifications', emailNotifications?.toString() || 'false', environment);
    
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
      console.log('[EMAIL-SETTINGS] Updating SMTP password in SSM:', {
        paramName: ENV === 'prod' ? '/PracticeTools/SMTP_PW' : `/PracticeTools/${ENV}/SMTP_PW`,
        passwordLength: smtpPassword.length,
        passwordType: typeof smtpPassword,
        passwordValue: smtpPassword.substring(0, 10) + '...',
        isTimestamp: smtpPassword.includes('T') && smtpPassword.includes('Z')
      });
      const passwordCommand = new PutParameterCommand({
        Name: ENV === 'prod' ? '/PracticeTools/SMTP_PW' : `/PracticeTools/${ENV}/SMTP_PW`,
        Value: String(smtpPassword),
        Type: 'String',
        Overwrite: true
      });
      await ssmClient.send(passwordCommand);
      console.log('[EMAIL-SETTINGS] SMTP password updated successfully');
    } else {
      console.log('[EMAIL-SETTINGS] No password provided, skipping SSM update');
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving email settings:', error);
    return NextResponse.json({ error: 'Failed to save email settings' }, { status: 500 });
  }
}

async function getSSMParameter(paramName) {
  try {
    const ssmPath = ENV === 'prod' ? `/PracticeTools/${paramName}` : `/PracticeTools/${ENV}/${paramName}`;
    const command = new GetParameterCommand({
      Name: ssmPath,
      WithDecryption: true
    });
    const response = await ssmClient.send(command);
    return response.Parameter?.Value || '';
  } catch (error) {
    console.error(`Failed to get SSM parameter ${ssmPath}:`, error.message);
    return '';
  }
}

export async function GET() {
  try {
    // Get environment for database operations
    const environment = process.env.ENVIRONMENT || 'dev';
    
    const emailNotifications = await db.getSetting('emailNotifications', environment);
    
    // Get all SMTP settings from SSM
    const [smtpHost, smtpPort, smtpUser, smtpPassword] = await Promise.all([
      getSSMParameter('SMTP_HOST'),
      getSSMParameter('SMTP_PORT'),
      getSSMParameter('SMTP_USERNAME'),
      getSSMParameter('SMTP_PW')
    ]);
    
    return NextResponse.json({
      settings: {
        emailNotifications: emailNotifications === 'true',
        smtpHost: smtpHost || '',
        smtpPort: smtpPort || '587',
        smtpUser: smtpUser || '',
        smtpPassword: smtpPassword ? '••••••••' : ''
      }
    });
  } catch (error) {
    console.error('Error loading email settings:', error);
    return NextResponse.json({ error: 'Failed to load email settings' }, { status: 500 });
  }
}