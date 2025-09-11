import { db } from './lib/dynamodb.js';

async function checkDevPracticeInfoPages() {
  try {
    console.log('Environment:', process.env.ENVIRONMENT || 'dev');
    console.log('Checking dev practice info pages...');
    
    const pages = await db.getPracticeInfoPages();
    console.log('Dev practice info pages found:', pages.length);
    console.log('Dev pages data:', JSON.stringify(pages, null, 2));
    
  } catch (error) {
    console.error('Error checking dev practice info pages:', error);
  }
}

checkDevPracticeInfoPages();