import { NextResponse } from 'next/server';
import { validateUserSession } from '../../../../lib/auth-check';
import { db } from '../../../../lib/dynamodb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const userCookie = request.cookies.get('user-session');
    const validation = await validateUserSession(userCookie);
    
    if (!validation.valid || !validation.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { botId } = await request.json();
    
    if (!botId) {
      return NextResponse.json({ error: 'Bot ID is required' }, { status: 400 });
    }
    
    // Get bot configuration
    const bots = await db.getWebexBots();
    const bot = bots.find(b => b.id === botId);
    
    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }
    
    // Get bot credentials from SSM
    const { SSMClient, GetParameterCommand } = await import('@aws-sdk/client-ssm');
    const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
    const ENV = process.env.ENVIRONMENT || 'prod';
    
    let token, roomId;
    
    try {
      const tokenParam = ENV === 'prod' ? `/PracticeTools/WEBEX_${bot.ssmPrefix}_ACCESS_TOKEN` : `/PracticeTools/${ENV}/WEBEX_${bot.ssmPrefix}_ACCESS_TOKEN`;
      const tokenCommand = new GetParameterCommand({ Name: tokenParam });
      const tokenResult = await ssmClient.send(tokenCommand);
      token = tokenResult.Parameter?.Value;
    } catch (error) {
      return NextResponse.json({ error: 'Bot access token not found' }, { status: 404 });
    }
    
    roomId = bot.roomId;
    if (!roomId) {
      return NextResponse.json({ error: 'Bot room ID not configured' }, { status: 404 });
    }
    
    // Sync users from this specific bot
    const response = await fetch(`https://webexapis.com/v1/memberships?roomId=${roomId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`WebEx API error for bot ${bot.friendlyName || bot.name}:`, response.status, errorText);
      
      if (response.status === 404) {
        return NextResponse.json({ 
          error: `Room not found for bot "${bot.friendlyName || bot.name}". The room may have been deleted or the bot may not have access.`,
          details: 'Please check the room ID configuration for this bot.'
        }, { status: 404 });
      }
      
      return NextResponse.json({ 
        error: `Failed to fetch room memberships for bot "${bot.friendlyName || bot.name}"`,
        details: errorText
      }, { status: 500 });
    }

    const data = await response.json();
    const memberships = data.items || [];
    const roomEmails = new Set();
    let syncedCount = 0;
    
    // Safety check: if we got 0 members, something is wrong - don't remove users
    if (memberships.length === 0) {
      return NextResponse.json({ 
        error: `No members found in room for bot "${bot.friendlyName || bot.name}". This may indicate an API issue or empty room. No users were modified.`,
        warning: true
      }, { status: 200 });
    }

    // Process current room members
    for (const membership of memberships) {
      if (membership.personEmail && !membership.personEmail.includes('@webex.bot')) {
        roomEmails.add(membership.personEmail);
        const role = membership.isModerator ? 'admin' : 'practice_member';
        
        // Check if user exists
        const existingUser = await db.getUser(membership.personEmail);
        
        if (!existingUser) {
          // Create new user with bot source
          await db.createOrUpdateUser(
            membership.personEmail,
            membership.personDisplayName || membership.personEmail.split('@')[0],
            'sso',
            'practice_member',
            null,
            'webex_sync',
            false,
            false,
            [],
            'staged',
            bot.friendlyName || bot.name
          );
          syncedCount++;
        } else if (existingUser.created_from === 'webex_sync') {
          // Add this bot to user's sources if not already present
          const currentSources = existingUser.webex_bot_sources || [];
          const botName = bot.friendlyName || bot.name;
          
          if (!currentSources.includes(botName)) {
            const updates = { webex_bot_sources: [...currentSources, botName] };
            await db.updateUser(membership.personEmail, updates);
          }
        }
      }
    }

    // Remove bot source from users no longer in this room
    const allUsers = await db.getAllUsers();
    let removedCount = 0;
    const botName = bot.friendlyName || bot.name;
    
    for (const user of allUsers) {
      if (user.created_from === 'webex_sync') {
        const currentSources = user.webex_bot_sources || [];
        
        // If user has this bot as a source but is no longer in the room
        if (currentSources.includes(botName) && !roomEmails.has(user.email)) {
          const updatedSources = currentSources.filter(s => s !== botName);
          
          if (updatedSources.length === 0) {
            // No more bot sources - delete user
            await db.deleteUser(user.email);
            removedCount++;
          } else {
            // Still has other bot sources - just remove this one and switch to first remaining
            await db.updateUser(user.email, { 
              webex_bot_sources: updatedSources,
              webex_bot_source: updatedSources[0] // Set primary to first remaining
            });
          }
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Synchronized ${syncedCount} new users, removed ${removedCount} users from ${bot.friendlyName || bot.name}` 
    });
  } catch (error) {
    console.error('Bot sync error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}