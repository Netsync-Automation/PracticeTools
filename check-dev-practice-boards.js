import { db } from './lib/dynamodb.js';

async function checkDevPracticeBoards() {
  try {
    console.log('Environment:', process.env.ENVIRONMENT || 'dev');
    console.log('Checking dev practice boards...');
    
    const settings = await db.getAllSettings();
    const practiceBoards = Object.keys(settings).filter(key => key.startsWith('practice_board_'));
    
    console.log('Dev practice boards found:', practiceBoards.length);
    console.log('Practice board keys:', practiceBoards);
    
    for (const key of practiceBoards) {
      console.log(`\n--- ${key} ---`);
      const boardData = JSON.parse(settings[key]);
      console.log('Practices:', boardData.practices);
      console.log('Created at:', boardData.createdAt);
      console.log('Columns:', boardData.columns.length);
    }
    
  } catch (error) {
    console.error('Error checking dev practice boards:', error);
  }
}

checkDevPracticeBoards();