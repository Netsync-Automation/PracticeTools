import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('auth-session');

    if (!sessionCookie) {
      return NextResponse.json(
        { message: 'No session found' },
        { status: 401 }
      );
    }

    const user = JSON.parse(sessionCookie.value);
    return NextResponse.json(user);
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json(
      { message: 'Invalid session' },
      { status: 401 }
    );
  }
}