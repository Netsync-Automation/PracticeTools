import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get practice managers directly
    const users = await db.getAllUsers();
    const practiceManagers = users.filter(user => user.role === 'practice_manager');
    
    // Group practices by manager
    const groups = practiceManagers.map(manager => {
      const practices = manager.practices || [];
      const displayName = practices.length === 1 
        ? practices[0] 
        : practices.join(', ');
      
      return {
        id: manager.email,
        displayName,
        managerName: manager.name,
        managerEmail: manager.email,
        practices: practices.sort()
      };
    });

    return NextResponse.json({ groups });
  } catch (error) {
    console.error('Error fetching practice groups:', error);
    return NextResponse.json({ error: 'Failed to fetch practice groups' }, { status: 500 });
  }
}