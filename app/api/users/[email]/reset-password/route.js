import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/dynamodb';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const { email } = params;
    const { password, forceReset } = await request.json();
    
    if (!forceReset && !password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }
    
    const success = forceReset 
      ? await db.setUserForcePasswordReset(email)
      : await db.resetUserPassword(email, password);
    
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}