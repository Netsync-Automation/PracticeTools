import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const practice = searchParams.get('practice');
    
    if (!practice) {
      return NextResponse.json({ error: 'Practice parameter required' }, { status: 400 });
    }
    
    // Get all users and filter for leadership roles in the specified practice
    const users = await db.getAllUsers();
    const leadership = users.filter(user => 
      (user.role === 'practice_manager' || user.role === 'practice_principal') &&
      (user.practices || []).includes(practice)
    );
    
    return NextResponse.json({ leadership });
  } catch (error) {
    console.error('Error fetching practice leadership:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}