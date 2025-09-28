import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/dynamodb';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export async function POST(request, { params }) {
  try {
    const { email } = params;
    const { password, forceReset, generateNew } = await request.json();
    
    // Get user to validate auth method
    const user = await db.getUser(email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Only allow password reset for local auth users
    if (user.auth_method !== 'local') {
      return NextResponse.json({ error: 'Password reset only available for local authentication users' }, { status: 400 });
    }
    
    if (forceReset) {
      const success = await db.setUserForcePasswordReset(email);
      return NextResponse.json({ success });
    }
    
    if (generateNew) {
      // Generate new password and send via email
      const newPassword = generatePassword();
      const success = await db.resetUserPassword(email, newPassword);
      
      if (success) {
        // Send email with new password
        try {
          const { emailService } = await import('../../../../../lib/email-service.js');
          await emailService.sendPasswordResetEmail(user.name, email, newPassword);
          return NextResponse.json({ success: true, message: 'New password generated and sent via email' });
        } catch (emailError) {
          console.error('Failed to send password reset email:', emailError);
          return NextResponse.json({ success: true, password: newPassword, message: 'Password reset but email failed to send' });
        }
      }
    } else {
      // Manual password reset
      if (!password) {
        return NextResponse.json({ error: 'Password is required' }, { status: 400 });
      }
      
      const success = await db.resetUserPassword(email, password);
      if (success) {
        return NextResponse.json({ success: true, message: 'Password updated successfully' });
      }
    }
    
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}