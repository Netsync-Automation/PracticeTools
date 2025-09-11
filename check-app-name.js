import { db } from './lib/dynamodb.js';

async function checkAppName() {
  try {
    console.log('Checking app_name in database...');
    const appName = await db.getSetting('app_name');
    console.log('Current app_name value:', appName);
    console.log('Type:', typeof appName);
    console.log('Length:', appName ? appName.length : 'null');
  } catch (error) {
    console.error('Error checking app_name:', error);
  }
  process.exit(0);
}

checkAppName();