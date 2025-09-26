const scheduledReminders = new Map();

export function scheduleReminder(reminderId, reminderTime, callback) {
  const now = new Date();
  const delay = reminderTime.getTime() - now.getTime();
  
  if (delay <= 0) return false; // Past due
  
  const timeoutId = setTimeout(() => {
    callback();
    scheduledReminders.delete(reminderId);
  }, delay);
  
  // Cancel existing reminder if it exists
  if (scheduledReminders.has(reminderId)) {
    clearTimeout(scheduledReminders.get(reminderId));
  }
  
  scheduledReminders.set(reminderId, timeoutId);
  return true;
}

export function cancelReminder(reminderId) {
  if (scheduledReminders.has(reminderId)) {
    clearTimeout(scheduledReminders.get(reminderId));
    scheduledReminders.delete(reminderId);
    return true;
  }
  return false;
}

export function getScheduledCount() {
  return scheduledReminders.size;
}