import { db } from './dynamodb';

export class WebexSync {
  static async syncRoomMembers() {
    try {
      // Get all configured WebEx bots
      const webexBots = await db.getWebexBots();
      
      if (!webexBots || webexBots.length === 0) {
        console.log('No WebEx bots configured - skipping sync');
        return false;
      }
      
      console.log(`Syncing ${webexBots.length} WebEx bot(s)`);
      
      const { SSMClient, GetParameterCommand } = await import('@aws-sdk/client-ssm');
      const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
      const ENV = process.env.ENVIRONMENT || 'dev';
      
      const allRoomEmails = new Set(); // Track all users across all rooms
      const successfullySyncedBots = new Set(); // Track which bots successfully synced
      
      // Sync each WebEx bot's room
      for (const bot of webexBots) {
        try {
          console.log(`Syncing bot: ${bot.friendlyName || bot.name}`);
          
          // Get token and room ID from SSM
          let token, roomId;
          
          try {
            const tokenParam = ENV === 'prod' ? `/PracticeTools/WEBEX_${bot.ssmPrefix}_ACCESS_TOKEN` : `/PracticeTools/${ENV}/WEBEX_${bot.ssmPrefix}_ACCESS_TOKEN`;
            const tokenCommand = new GetParameterCommand({ Name: tokenParam });
            const tokenResult = await ssmClient.send(tokenCommand);
            token = tokenResult.Parameter?.Value;
          } catch (error) {
            console.log(`WebEx token not found for ${bot.friendlyName}:`, error.message);
            continue;
          }
          
          try {
            const roomIdParam = ENV === 'prod' ? `/PracticeTools/WEBEX_${bot.ssmPrefix}_ROOM_ID_1` : `/PracticeTools/${ENV}/WEBEX_${bot.ssmPrefix}_ROOM_ID_1`;
            const roomIdCommand = new GetParameterCommand({ Name: roomIdParam });
            const roomIdResult = await ssmClient.send(roomIdCommand);
            roomId = roomIdResult.Parameter?.Value;
          } catch (error) {
            console.log(`WebEx room ID not found for ${bot.friendlyName}:`, error.message);
            continue;
          }
          
          if (!token || !roomId) {
            console.log(`WebEx not properly configured for ${bot.friendlyName} - skipping`);
            continue;
          }
          
          // Get room memberships
          const response = await fetch(`https://webexapis.com/v1/memberships?roomId=${roomId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            console.error(`Failed to fetch memberships for ${bot.friendlyName}:`, response.status);
            continue;
          }

          const data = await response.json();
          const memberships = data.items || [];
          
          console.log(`Found ${memberships.length} members in ${bot.friendlyName} room`);
          
          // Safety check: if 0 members, don't mark as successfully synced (likely an error)
          if (memberships.length === 0) {
            console.log(`Skipping ${bot.friendlyName} - 0 members returned (possible API issue)`);
            continue;
          }
          
          // Mark this bot as successfully synced
          successfullySyncedBots.add(bot.friendlyName || bot.name);

          // Process current room members
          for (const membership of memberships) {
            if (membership.personEmail && !membership.personEmail.includes('@webex.bot')) {
              allRoomEmails.add(membership.personEmail); // Add to global set
              
              // Check if user exists
              const existingUser = await db.getUser(membership.personEmail);
              
              if (!existingUser) {
                // Determine practice assignment and status based on bot configuration
                const botPractices = bot.practices || [];
                let assignedPractices = [];
                let userStatus = 'staged';
                
                // Only assign practice if bot has exactly one practice configured
                if (botPractices.length === 1) {
                  assignedPractices = botPractices;
                  userStatus = 'active';
                  console.log(`Assigning single practice to new user: ${membership.personEmail} -> ${botPractices[0]}`);
                } else if (botPractices.length > 1) {
                  console.log(`Multiple practices configured for bot ${bot.friendlyName}, staging user: ${membership.personEmail}`);
                } else {
                  console.log(`No practices configured for bot ${bot.friendlyName}, staging user: ${membership.personEmail}`);
                }
                
                // Create new user with practice_member role
                await db.createOrUpdateUser(
                  membership.personEmail,
                  membership.personDisplayName || membership.personEmail.split('@')[0],
                  'sso',
                  'practice_member',
                  null,
                  'webex_sync',
                  false,
                  false,
                  assignedPractices,
                  userStatus,
                  bot.friendlyName || bot.name
                );
                console.log(`Created user: ${membership.personEmail} from ${bot.friendlyName} with status: ${userStatus}`);
              } else if (existingUser.created_from === 'webex_sync') {
                // Existing WebEx-synced users retain their original settings - no changes
                console.log(`Preserving existing WebEx user settings: ${membership.personEmail}`);
              } else if (existingUser.created_from !== 'webex_sync') {
                console.log(`Skipping local user: ${membership.personEmail} - local users take precedence`);
              }
            }
          }
        } catch (botError) {
          console.error(`Error syncing bot ${bot.friendlyName}:`, botError.message);
        }
      }

      // Only remove users whose bot successfully synced and they're not in that bot's room
      const allUsers = await db.getAllUsers();
      for (const user of allUsers) {
        if (user.created_from === 'webex_sync' && 
            user.webex_bot_source && 
            successfullySyncedBots.has(user.webex_bot_source) && 
            !allRoomEmails.has(user.email)) {
          await db.deleteUser(user.email);
          console.log(`Removed user no longer in ${user.webex_bot_source} room: ${user.email}`);
        }
      }

      console.log(`WebEx sync completed. Total unique users across all rooms: ${allRoomEmails.size}`);
      return true;
    } catch (error) {
      console.error('WebEx sync error:', error);
      return false;
    }
  }

  static async syncOnAction() {
    try {
      console.log('Auto-syncing WebEx users on action');
      const result = await this.syncRoomMembers();
      console.log('Auto-sync result:', result ? 'success' : 'failed');
      return result;
    } catch (error) {
      console.error('Auto-sync error:', error);
      return false;
    }
  }
}