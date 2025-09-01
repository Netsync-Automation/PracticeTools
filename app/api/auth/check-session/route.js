import { NextResponse } from 'next/server';
import { validateUserSession } from '../../../../lib/auth-check';
import { db } from '../../../../lib/dynamodb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  console.log('[CHECK-SESSION] API called');
  const userCookie = request.cookies.get('user-session');
  console.log('[CHECK-SESSION] Cookie from request:', {
    exists: !!userCookie,
    name: userCookie?.name,
    valueLength: userCookie?.value?.length || 0
  });
  
  const validation = await validateUserSession(userCookie);
  console.log('[CHECK-SESSION] Validation result:', {
    valid: validation.valid,
    error: validation.error,
    userEmail: validation.user?.email
  });
  
  if (validation.valid) {
    // Check if user is staged
    if (validation.user.status === 'staged') {
      console.log('[CHECK-SESSION] Staged user blocked:', validation.user.email);
      return NextResponse.json({ authenticated: false, error: 'Account pending activation. Please contact an administrator.' }, { status: 403 });
    }
    
    const responseUser = {
      ...validation.user,
      isAdmin: validation.user.isAdmin || false
    };
    console.log('[CHECK-SESSION] Returning success for:', responseUser.email);
    return NextResponse.json({ 
      authenticated: true, 
      user: responseUser
    });
  }
  
  console.log('[CHECK-SESSION] Returning 401 - validation failed:', validation.error);
  return NextResponse.json({ authenticated: false, error: validation.error }, { status: 401 });
}