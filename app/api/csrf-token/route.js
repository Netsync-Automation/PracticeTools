import { NextResponse } from 'next/server';
import { generateCSRFToken } from '../../../lib/csrf.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // DSR: Use industry-standard CSRF token generation
    const token = generateCSRFToken(process.env.CSRF_SECRET);
    
    const response = NextResponse.json({ token });
    
    // DSR: Double-submit cookie pattern for enhanced security
    response.cookies.set('csrf-token', token, {
      httpOnly: true,
      secure: process.env.NEXTAUTH_URL?.startsWith('https://') || false,
      sameSite: 'strict',
      maxAge: 30 * 60 // 30 minutes (matches token expiration)
    });
    
    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate CSRF token' }, { status: 500 });
  }
}