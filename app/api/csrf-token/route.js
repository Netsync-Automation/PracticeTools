import { NextResponse } from 'next/server';
import { generateCSRFToken } from '../../../lib/csrf';

export async function GET(request) {
  try {
    const sessionId = request.cookies.get('user-session')?.value || 'anonymous';
    const token = generateCSRFToken(sessionId);
    
    return NextResponse.json({ token });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate CSRF token' }, { status: 500 });
  }
}