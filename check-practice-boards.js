// Force production environment BEFORE any imports
process.env.ENVIRONMENT = 'prod';

// Now import after setting environment
import { db } from './lib/dynamodb.js';

async function checkPracticeBoards() {
  try {
    console.log('Forced environment to:', process.env.ENVIRONMENT);
    console.log('Checking production practice boards...');
    
    const settings = await db.getAllSettings();
    const practiceBoards = Object.keys(settings).filter(key => key.startsWith('practice_board_'));
    
    console.log('Production practice boards found:', practiceBoards.length);
    console.log('Practice board keys:', practiceBoards);
    
    for (const key of practiceBoards) {
      console.log(`\n--- ${key} ---`);
      const boardData = JSON.parse(settings[key]);
      console.log('Practices:', boardData.practices);
      console.log('Created at:', boardData.createdAt);
      console.log('Columns:', boardData.columns.length);
    }
    
  } catch (error) {
    console.error('Error checking production practice boards:', error);
  }
}

checkPracticeBoards();