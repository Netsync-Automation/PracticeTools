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

          // Process current room members
          for (const membership of memberships) {
            if (membership.personEmail && !membership.personEmail.includes('@webex.bot')) {
              allRoomEmails.add(membership.personEmail); // Add to global set
              const role = membership.isModerator ? 'admin' : 'practice_member';
              
              // Check if user exists
              const existingUser = await db.getUser(membership.personEmail);
              
              if (!existingUser) {
                // Create new user in staged status with bot source
                await db.createOrUpdateUser(
                  membership.personEmail,
                  membership.personDisplayName || membership.personEmail.split('@')[0],
                  'sso',
                  'practice_member',
                  null,
                  'webex_sync',
                  false,
                  false,
                  bot.practices || [],
                  'staged'
                );
                console.log(`Created staged user: ${membership.personEmail} from ${bot.friendlyName}`);
              } else if (existingUser.created_from === 'webex_sync' && existingUser.status !== 'staged') {
                // Update practices for WebEx-synced users (merge practices from all bots)
                const currentPractices = existingUser.practices || [];
                const newPractices = [...new Set([...currentPractices, ...(bot.practices || [])])];
                
                if (JSON.stringify(currentPractices.sort()) !== JSON.stringify(newPractices.sort())) {
                  await db.updateUser(membership.personEmail, { practices: newPractices });
                  console.log(`Updated practices for ${membership.personEmail}: ${newPractices.join(', ')}`);
                }
              } else if (existingUser.created_from !== 'webex_sync') {
                console.log(`Skipping local user: ${membership.personEmail} - local users take precedence`);
              }
            }
          }
        } catch (botError) {
          console.error(`Error syncing bot ${bot.friendlyName}:`, botError.message);
        }
      }

      // Only remove users who are no longer in ANY WebEx room (only WebEx-synced users)
      const allUsers = await db.getAllUsers();
      for (const user of allUsers) {
        if (user.created_from === 'webex_sync' && !allRoomEmails.has(user.email)) {
          await db.deleteUser(user.email);
          console.log(`Removed user no longer in any WebEx room: ${user.email}`);
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