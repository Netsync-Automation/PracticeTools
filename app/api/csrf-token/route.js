import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const token = crypto.randomBytes(32).toString('hex');
    
    const response = NextResponse.json({ token });
    
    // Set CSRF token in httpOnly cookie for server-side validation
    response.cookies.set('csrf-token', token, {
      httpOnly: true,
      secure: process.env.ENVIRONMENT === 'prod',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 // 24 hours
    });
    
    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate CSRF token' }, { status: 500 });
  }
}