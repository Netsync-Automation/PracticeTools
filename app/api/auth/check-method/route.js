import { NextResponse } from 'next/server';
import { AuthHandler } from '../../../../lib/auth-handler';

export async function POST(request) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    
    const result = await AuthHandler.checkUserAuthMethod(email);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Check auth method error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}