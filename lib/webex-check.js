import { db } from './dynamodb';

// Check if webex notifications are enabled
export async function isWebexNotificationsEnabled() {
  try {
    const setting = await db.getSetting('webex_notifications');
    return setting === 'true' || setting === null; // Default to true if not set
  } catch (error) {
    console.error('Error checking webex notifications setting:', error);
    return true; // Default to enabled on error
  }
}