import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb';
import { validateUserSession } from '../../../lib/auth-check';

export async function GET(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const practices = searchParams.get('practices');
    
    if (!practices) {
      return NextResponse.json({ error: 'Practices parameter required' }, { status: 400 });
    }

    const practiceList = practices.split(',');
    const etas = {};
    
    for (const practice of practiceList) {
      const eta = await db.getPracticeETA(practice);
      if (eta) {
        etas[practice] = eta;
      }
    }

    return NextResponse.json({ success: true, etas });
  } catch (error) {
    console.error('Error fetching practice ETAs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch practice ETAs' },
      { status: 500 }
    );
  }
}