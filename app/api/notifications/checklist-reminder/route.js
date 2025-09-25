import { getEnvironment, getTableName } from '../../../../lib/dynamodb.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

export async function POST(request) {
  try {
    const { 
      cardId, 
      columnId, 
      practiceId, 
      checklistIndex, 
      itemIndex, 
      checklistItem, 
      cardData 
    } = await request.json();

    // Get assigned users for the checklist item
    const assignedUsers = checklistItem.assignedTo || [];
    
    if (assignedUsers.length === 0 || !checklistItem.dueDate || !checklistItem.reminderOption) {
      return Response.json({ success: true, message: 'No reminder needed' });
    }

    // Calculate reminder time
    let reminderTime;
    const dueDateTime = new Date(`${checklistItem.dueDate}T${checklistItem.dueTime || '23:59'}`);
    
    switch (checklistItem.reminderOption) {
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
        if (checklistItem.customReminderDate && checklistItem.customReminderTime) {
          reminderTime = new Date(`${checklistItem.customReminderDate}T${checklistItem.customReminderTime}`);
        }
        break;
    }

    if (!reminderTime || reminderTime <= new Date()) {
      return Response.json({ success: true, message: 'Reminder time has passed' });
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

    // Get Webex bot for the first practice (alphabetically)
    const primaryPractice = board.practices.sort()[0];
    
    // Get all Webex bots from Settings table
    const settingsTable = getTableName('Settings');
    const botQuery = new ScanCommand({
      TableName: settingsTable,
      FilterExpression: 'begins_with(setting_key, :prefix)',
      ExpressionAttributeValues: {
        ':prefix': { S: 'webex_bot_' }
      }
    });
    
    const botResult = await docClient.send(botQuery);
    const allBots = (botResult.Items || []).map(item => JSON.parse(item.setting_value?.S || '{}'));
    const webexBot = allBots.find(bot => bot.practices && bot.practices.includes(primaryPractice));
    
    if (!webexBot?.accessToken) {
      console.log(`No Webex bot found for practice: ${primaryPractice}`);
      return Response.json({ success: false, message: 'No Webex bot configured for practice' });
    }

    // Send direct messages to assigned users
    const notificationPromises = assignedUsers.map(async (userEmail) => {
      try {
        const message = `🔔 **Checklist Item Reminder**\n\n` +
          `**Card:** ${cardData.title}\n` +
          `**Checklist Item:** ${checklistItem.text}\n` +
          `**Due:** ${dueDateTime.toLocaleDateString()} at ${checklistItem.dueTime || 'End of day'}\n\n` +
          `This is a reminder for your assigned checklist item.`;

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
      message: 'Checklist reminder sent',
      reminderTime: reminderTime.toISOString(),
      notificationsSent: successCount,
      totalAssigned: assignedUsers.length
    });

  } catch (error) {
    console.error('Error processing checklist reminder:', error);
    return Response.json(
      { error: 'Failed to process checklist reminder' },
      { status: 500 }
    );
  }
}