const { db, getEnvironment } = require('./lib/dynamodb.js');

async function debugPracticeBoardsList() {
  console.log('=== DEBUGGING PRACTICE BOARDS LIST ===');
  
  try {
    // Get all practice boards
    const boards = await db.getAllPracticeBoards();
    console.log(`\nFound ${boards.length} practice boards:`);
    
    boards.forEach((board, index) => {
      console.log(`\nBoard ${index + 1}:`);
      console.log(`- Practice ID: ${board.practiceId}`);
      console.log(`- Practices: [${board.practices?.join(', ') || 'none'}]`);
      console.log(`- Manager ID: ${board.managerId || 'none'}`);
      console.log(`- Created At: ${board.createdAt || 'unknown'}`);
      console.log(`- Columns: ${board.columns?.length || 0}`);
    });
    
    // Look for Singlewire-related boards
    const singlewireBoards = boards.filter(board => 
      board.practices?.some(practice => 
        practice.toLowerCase().includes('singlewire') || 
        practice.toLowerCase().includes('physical') ||
        practice.toLowerCase().includes('security')
      ) ||
      board.practiceId?.toLowerCase().includes('singlewire') ||
      board.practiceId?.toLowerCase().includes('physical') ||
      board.practiceId?.toLowerCase().includes('security')
    );
    
    console.log(`\n=== SINGLEWIRE-RELATED BOARDS ===`);
    if (singlewireBoards.length > 0) {
      singlewireBoards.forEach((board, index) => {
        console.log(`\nSinglewire Board ${index + 1}:`);
        console.log(`- Practice ID: ${board.practiceId}`);
        console.log(`- Practices: [${board.practices?.join(', ') || 'none'}]`);
      });
    } else {
      console.log('No Singlewire-related boards found');
    }
    
    // Also check all settings that start with practice_board to see raw data
    console.log(`\n=== RAW PRACTICE BOARD SETTINGS ===`);
    const environment = getEnvironment();
    console.log(`Environment: ${environment}`);
    
    const allSettings = await db.getAllSettings();
    const boardSettings = allSettings.filter(setting => 
      setting.setting_key.includes('practice_board')
    );
    
    console.log(`\nFound ${boardSettings.length} practice board settings:`);
    boardSettings.forEach(setting => {
      console.log(`- Key: ${setting.setting_key}`);
      try {
        const data = JSON.parse(setting.setting_value);
        console.log(`  - Practices: [${data.practices?.join(', ') || 'none'}]`);
        console.log(`  - Columns: ${data.columns?.length || 0}`);
        if (data.columns) {
          let totalCards = 0;
          data.columns.forEach(col => totalCards += (col.cards?.length || 0));
          console.log(`  - Total Cards: ${totalCards}`);
        }
      } catch (error) {
        console.log(`  - Error parsing: ${error.message}`);
      }
    });
    
  } catch (error) {
    console.error('Error debugging practice boards:', error);
  }
}

debugPracticeBoardsList().catch(console.error);