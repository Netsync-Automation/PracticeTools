import { db } from '../../../../lib/dynamodb.js';
import { scheduleReminder } from '../../../../lib/scheduler.js';
import { sendCardReminder } from '../../../../lib/notifications.js';

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
    const dueDateTime = new Date(`${cardData.dueDate}T${cardData.dueTime || '23:59'}`);
    let reminderTime;
    
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

    if (!reminderTime) {
      return Response.json({ success: false, message: 'Invalid reminder configuration' });
    }

    // Get followers and assigned users
    const cardKey = `${practiceId}_${columnId}_${cardId}`;
    const followers = await db.getCardFollowers(cardKey);
    const assignedUsers = cardData.assignedTo || [];
    const allUsers = [...new Set([...followers, ...assignedUsers])];
    
    if (allUsers.length === 0) {
      return Response.json({ success: true, message: 'No users to notify' });
    }

    const reminderId = `card_${cardId}`;
    
    const scheduled = scheduleReminder(reminderId, reminderTime, () => {
      sendCardReminder(cardData, practiceId, columnId, allUsers, followers, assignedUsers);
    });

    if (!scheduled) {
      return Response.json({ success: false, message: 'Reminder time has passed' });
    }

    return Response.json({ 
      success: true, 
      message: 'Card reminder scheduled',
      reminderTime: reminderTime.toISOString(),
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