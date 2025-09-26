import { scheduleReminder } from '../../../../lib/scheduler.js';
import { sendChecklistReminder } from '../../../../lib/notifications.js';

export async function POST(request) {
  try {
    const { 
      cardId, 
      checklistIndex, 
      itemIndex, 
      checklistItem, 
      cardData,
      practiceId,
      currentUserEmail
    } = await request.json();

    if (!checklistItem.dueDate || !checklistItem.reminderOption) {
      return Response.json({ success: true, message: 'No reminder needed' });
    }

    // Get assigned users for this checklist item
    const assignedUsers = checklistItem.assignedTo || [];
    if (assignedUsers.length === 0) {
      console.log('🔔 [CHECKLIST REMINDER] No users assigned to checklist item, skipping reminder');
      return Response.json({ success: true, message: 'No users assigned to checklist item' });
    }

    // Calculate reminder time
    const dueDateTime = new Date(`${checklistItem.dueDate}T${checklistItem.dueTime || '23:59'}`);
    let reminderTime;
    
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

    if (!reminderTime) {
      return Response.json({ success: false, message: 'Invalid reminder configuration' });
    }

    // Schedule reminder for all assigned users
    console.log('🔔 [CHECKLIST REMINDER] Scheduling reminders:', {
      reminderTime: reminderTime.toISOString(),
      assignedUsers,
      checklistItem: checklistItem.text,
      cardTitle: cardData.title
    });
    
    const scheduledCount = assignedUsers.filter(userEmail => {
      const reminderId = `${userEmail}_${cardId}_${checklistIndex}_${itemIndex}`;
      const scheduled = scheduleReminder(reminderId, reminderTime, () => {
        console.log('🔔 [CHECKLIST REMINDER] Executing reminder for:', userEmail, checklistItem.text);
        sendChecklistReminder(userEmail, { ...cardData, practiceId: practiceId }, checklistItem);
      });
      console.log('🔔 [CHECKLIST REMINDER] Scheduled for user:', userEmail, 'success:', scheduled);
      return scheduled;
    }).length;
    
    console.log('🔔 [CHECKLIST REMINDER] Total scheduled:', scheduledCount, 'out of', assignedUsers.length);

    return Response.json({ 
      success: true, 
      message: `Reminder scheduled for ${scheduledCount} user(s)`,
      reminderTime: reminderTime.toISOString(),
      scheduledFor: assignedUsers
    });

  } catch (error) {
    console.error('Error scheduling checklist reminder:', error);
    return Response.json(
      { error: 'Failed to schedule reminder' },
      { status: 500 }
    );
  }
}