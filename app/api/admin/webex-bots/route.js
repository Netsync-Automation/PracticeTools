import { NextResponse } from 'next/server';
import { validateUserSession } from '../../../../lib/auth-check';
import { db } from '../../../../lib/dynamodb';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = validation.user;
    
    // Allow admins to see all bots, practice managers/principals see filtered bots
    if (user.isAdmin) {
      const bots = await db.getWebexBots();
      return NextResponse.json({ bots });
    } else if (user.role === 'practice_manager' || user.role === 'practice_principal') {
      const allBots = await db.getWebexBots();
      // Filter bots to only show those that include user's practices
      const userPractices = user.practices || [];
      const filteredBots = allBots.filter(bot => 
        bot.practices && bot.practices.some(practice => userPractices.includes(practice))
      );
      return NextResponse.json({ bots: filteredBots });
    } else {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
  } catch (error) {
    console.error('Error fetching WebEx bots:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}