import { NextResponse } from 'next/server';
import { validateUserSession } from '../../../../lib/auth-check';
import { db } from '../../../../lib/dynamodb';
import { getCached, setCached } from '../../../../lib/cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  const userCookie = request.cookies.get('user-session');
  
  // Cache key based on cookie value
  const cacheKey = `session_${userCookie?.value?.substring(0, 20) || 'none'}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }
  
  const validation = await validateUserSession(userCookie);
  let response;
  
  if (validation.valid) {
    // Check if user is staged
    if (validation.user.status === 'staged') {
      response = { authenticated: false, error: 'Account pending activation. Please contact an administrator.' };
      return NextResponse.json(response, { status: 403 });
    }
    
    const responseUser = {
      ...validation.user,
      isAdmin: validation.user.isAdmin || false
    };
    response = { 
      authenticated: true, 
      user: responseUser
    };
    setCached(cacheKey, response, 30000); // Cache for 30 seconds
    return NextResponse.json(response);
  }
  
  response = { authenticated: false, error: validation.error };
  return NextResponse.json(response, { status: 401 });
}