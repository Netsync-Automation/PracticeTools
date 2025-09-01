import { NextResponse } from 'next/server';
import { db } from '../../../../lib/dynamodb.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const users = await db.getAllUsers();
    
    // Filter for leaders: practice_manager, practice_principal, and admin roles
    const leaders = users.filter(user => 
      user.role === 'practice_manager' || 
      user.role === 'practice_principal' || 
      user.isAdmin
    );
    
    return NextResponse.json({ leaders });
  } catch (error) {
    console.error('Error fetching leaders:', error);
    return NextResponse.json({ error: 'Failed to fetch leaders' }, { status: 500 });
  }
}