import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb';

export async function POST(request) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }
    
    const user = await db.getUser(email);
    
    return NextResponse.json({ 
      name: user?.name || email,
      email: email 
    });
  } catch (error) {
    console.error('User lookup error:', error);
    return NextResponse.json({ 
      name: email,
      email: email 
    });
  }
}