import { NextResponse } from 'next/server';
import { db } from '../../../lib/dynamodb';
import { validateUserSession } from '../../../lib/auth-check';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { issueId, practice, creatorEmail } = await request.json();
    
    if (!issueId || !practice || !creatorEmail) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }
    
    const user = validation.user;
    
    // Check if user has access to this Leadership Question
    const isCreator = creatorEmail === user.email;
    const isPracticeLeadership = (user.role === 'practice_manager' || user.role === 'practice_principal') && 
      user.practices && user.practices.includes(practice);
    const isAdmin = user.isAdmin;
    
    if (!isCreator && !isPracticeLeadership && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    // Get all users to find relevant names
    const allUsers = await db.getAllUsers();
    
    // Find practice leadership for this practice
    const practiceLeaders = allUsers.filter(u => 
      (u.role === 'practice_manager' || u.role === 'practice_principal') &&
      u.practices && u.practices.includes(practice)
    );
    
    // Find creator
    const creator = allUsers.find(u => u.email === creatorEmail);
    
    return NextResponse.json({
      practiceLeaders: practiceLeaders.map(leader => ({
        name: leader.name,
        role: leader.role
      })),
      creator: creator ? { name: creator.name, email: creator.email } : null
    });
    
  } catch (error) {
    console.error('Error in leadership visibility API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}