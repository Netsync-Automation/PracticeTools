import { NextResponse } from 'next/server';
import { DynamoDBService } from '../../../../lib/dynamodb';

const db = new DynamoDBService();

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { botId, roomId, roomName } = await request.json();
    
    if (!botId || !roomId) {
      return NextResponse.json({ error: 'Bot ID and room ID are required' }, { status: 400 });
    }
    
    // DSR: Get existing bot from settings table
    const bots = await db.getWebexBots();
    const bot = bots.find(b => b.id === botId);
    
    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }
    
    // DSR: Update bot to new structure - existing room becomes Practice Issues (Room 1)
    const updatedBot = {
      ...bot,
      roomId: roomId,  // Existing room becomes Practice Issues
      roomName: roomName || 'Practice Issues',
      resourceRoomId: '',  // No Room 2 initially
      resourceRoomName: '',
      migrated: true,  // Mark as migrated
      updatedAt: new Date().toISOString()
    };
    
    console.log('DSR: Updating bot with new structure:', JSON.stringify(updatedBot, null, 2));
    const success = await db.saveWebexBot(updatedBot);
    console.log('DSR: Bot update result:', success);
    
    if (success) {
      console.log(`DSR: Successfully migrated legacy WebEx bot ${botId} - existing room now mapped to Practice Issues`);
      return NextResponse.json({ 
        success: true,
        message: 'Legacy WebEx bot migrated - existing room now handles Practice Issues notifications'
      });
    } else {
      return NextResponse.json({ error: 'Failed to update bot record' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error migrating legacy WebEx bot:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}