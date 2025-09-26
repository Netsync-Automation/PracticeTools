import { getEnvironment, getTableName, getCardFollowers } from '../../../../lib/dynamodb.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

export async function POST(request) {
  try {
    const { 
      cardId, 
      columnId, 
      practiceId, 
      cardData 
    } = await request.json();

    if (!cardData.dueDate || !cardData.reminderOption) {
      return Response.json({ success: true, message: 'No reminder needed' });
    }

    // Calculate reminder time
    let reminderTime;
    const dueDateTime = new Date(`${cardData.dueDate}T${cardData.dueTime || '23:59'}`);
    
    switch (cardData.reminderOption) {
      case '15min':
        reminderTime = new Date(dueDateTime.getTime() - 15 * 60 * 1000);
        break;
      case '1hour':
        reminderTime = new Date(dueDateTime.getTime() - 60 * 60 * 1000);
        break;
      case '1day':
        reminderTime = new Date(dueDateTime.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        if (cardData.customReminderDate && cardData.customReminderTime) {
          reminderTime = new Date(`${cardData.customReminderDate}T${cardData.customReminderTime}`);
        }
        break;
    }

    if (!reminderTime || reminderTime <= new Date()) {
      return Response.json({ success: true, message: 'Reminder time has passed' });
    }

    // Get followers and assigned users
    const cardKey = `${practiceId}_${columnId}_${cardId}`;
    const followers = await getCardFollowers(cardKey);
    const assignedUsers = cardData.assignedTo || [];
    
    // Combine and deduplicate users
    const allUsers = [...new Set([...followers, ...assignedUsers])];
    
    if (allUsers.length === 0) {
      return Response.json({ success: true, message: 'No users to notify' });
    }

    // Get practice-specific Webex bot
    const client = new DynamoDBClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
    const docClient = DynamoDBDocumentClient.from(client);
    
    // Get board practices from practiceId
    const boardsTable = getTableName('PracticeBoards');
    const boardCommand = new GetCommand({
      TableName: boardsTable,
      Key: { practiceId }
    });
    
    const boardResult = await docClient.send(boardCommand);
    const board = boardResult.Item;
    
    if (!board?.practices?.length) {
      return Response.json({ success: false, message: 'No practices found for board' });
    }

    // Get Webex bot for board practices from admin settings
    const settingsTable = getTableName('Settings');
    const settingsQuery = new ScanCommand({
      TableName: settingsTable,
      FilterExpression: 'begins_with(setting_key, :prefix)',
      ExpressionAttributeValues: {
        ':prefix': 'webex_bot_'
      }
    });
    
    const settingsResult = await docClient.send(settingsQuery);
    const webexBots = (settingsResult.Items || []).map(item => ({
      key: item.setting_key,
      value: JSON.parse(item.setting_value || '{}')
    }));
    
    // Find bot that matches any of the board's practices
    let webexBot = null;
    for (const bot of webexBots) {
      if (bot.value.practices && bot.value.practices.some(practice => board.practices.includes(practice))) {
        webexBot = bot.value;
        break;
      }
    }
    
    if (!webexBot?.accessToken) {
      console.log(`No Webex bot found for practices: ${board.practices.join(', ')}`);
      return Response.json({ success: false, message: 'No Webex bot configured for board practices' });
    }

    // Send direct messages to all users
    const notificationPromises = allUsers.map(async (userEmail) => {
      try {
        const message = `🔔 **Card Due Date Reminder**\n\n` +
          `**Card:** ${cardData.title}\n` +
          `**Due:** ${dueDateTime.toLocaleDateString()} at ${cardData.dueTime || 'End of day'}\n\n` +
          `This card is due soon. You are receiving this reminder because you are ${
            followers.includes(userEmail) && assignedUsers.includes(userEmail) 
              ? 'following and assigned to' 
              : followers.includes(userEmail) 
                ? 'following' 
                : 'assigned to'
          } this card.`;

        const webexResponse = await fetch('https://webexapis.com/v1/messages', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${webexBot.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            toPersonEmail: userEmail,
            markdown: message
          })
        });

        return webexResponse.ok;
      } catch (error) {
        console.error(`Error sending reminder to ${userEmail}:`, error);
        return false;
      }
    });

    const results = await Promise.all(notificationPromises);
    const successCount = results.filter(Boolean).length;

    return Response.json({ 
      success: true, 
      message: 'Card reminder sent',
      reminderTime: reminderTime.toISOString(),
      notificationsSent: successCount,
      totalUsers: allUsers.length
    });

  } catch (error) {
    console.error('Error processing card reminder:', error);
    return Response.json(
      { error: 'Failed to process card reminder' },
      { status: 500 }
    );
  }
}