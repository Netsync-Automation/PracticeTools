import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET() {
  try {
    const secret = process.env.CSRF_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'CSRF secret not configured' }, { status: 500 });
    }

    // Generate token with timestamp
    const timestamp = Date.now().toString();
    const token = crypto.createHmac('sha256', secret)
      .update(timestamp)
      .digest('hex');

    return NextResponse.json({ 
      token: `${timestamp}.${token}`,
      expires: Date.now() + (15 * 60 * 1000) // 15 minutes
    });
  } catch (error) {
    console.error('Error generating CSRF token:', error);
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
  }
}