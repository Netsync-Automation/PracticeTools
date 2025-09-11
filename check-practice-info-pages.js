// Force production environment
process.env.ENVIRONMENT = 'prod';

import { db } from './lib/dynamodb.js';

async function checkPracticeInfoPages() {
  try {
    console.log('Forced environment to:', process.env.ENVIRONMENT);
    console.log('Checking production practice info pages...');
    
    const pages = await db.getPracticeInfoPages();
    console.log('Production practice info pages found:', pages.length);
    console.log('Production pages data:', JSON.stringify(pages, null, 2));
    
  } catch (error) {
    console.error('Error checking production practice info pages:', error);
  }
}

checkPracticeInfoPages();