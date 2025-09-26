import { DynamoDBService } from './lib/dynamodb.js';

async function checkAllCards() {
  const db = new DynamoDBService();
  
  console.log('=== SEARCHING ALL CARDS FOR "SINGLEWIRE" OR "FORT WORTH" ===');
  
  try {
    // Get all practice boards
    const boards = await db.getAllPracticeBoards();
    console.log(`Found ${boards.length} practice boards`);
    
    let allCards = [];
    
    // Search through all boards for any cards containing "singlewire" or "fort worth"
    for (const board of boards) {
      const boardKey = `dev_practice_board_${board.practiceId}`;
      const boardData = await db.getSetting(boardKey);
      
      if (boardData) {
        const parsedBoard = JSON.parse(boardData);
        
        if (parsedBoard.columns) {
          for (const column of parsedBoard.columns) {
            if (column.cards) {
              for (const card of column.cards) {
                const title = (card.title || '').toLowerCase();
                if (title.includes('singlewire') || title.includes('fort worth')) {
                  console.log(`\n🎯 FOUND MATCHING CARD:`);
                  console.log(`  Title: "${card.title}"`);
                  console.log(`  ID: ${card.id}`);
                  console.log(`  Board: ${board.practices.join(', ')}`);
                  console.log(`  Column: ${column.title}`);
                  console.log(`  Followers: ${JSON.stringify(card.followers || [])}`);
                  console.log(`  Followers count: ${(card.followers || []).length}`);
                  
                  allCards.push({
                    title: card.title,
                    id: card.id,
                    board: board.practices.join(', '),
                    column: column.title,
                    followers: card.followers || []
                  });
                }
              }
            }
          }
        }
      }
    }
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Found ${allCards.length} cards matching "singlewire" or "fort worth"`);
    
    if (allCards.length === 0) {
      console.log('❌ No cards found with those keywords');
    } else {
      allCards.forEach((card, index) => {
        console.log(`\n${index + 1}. "${card.title}"`);
        console.log(`   ID: ${card.id}`);
        console.log(`   Board: ${card.board}`);
        console.log(`   Followers: ${card.followers.length > 0 ? card.followers.join(', ') : 'None'}`);
      });
    }
    
    // Also check if mbgriffin@netsync.com is following ANY cards
    console.log(`\n=== CHECKING ALL FOLLOWS FOR mbgriffin@netsync.com ===`);
    
    let userFollowingAnyCards = [];
    
    for (const board of boards) {
      const boardKey = `dev_practice_board_${board.practiceId}`;
      const boardData = await db.getSetting(boardKey);
      
      if (boardData) {
        const parsedBoard = JSON.parse(boardData);
        
        if (parsedBoard.columns) {
          for (const column of parsedBoard.columns) {
            if (column.cards) {
              for (const card of column.cards) {
                if (card.followers && card.followers.includes('mbgriffin@netsync.com')) {
                  userFollowingAnyCards.push({
                    title: card.title,
                    id: card.id,
                    board: board.practices.join(', ')
                  });
                }
              }
            }
          }
        }
      }
    }
    
    console.log(`Found ${userFollowingAnyCards.length} cards that mbgriffin@netsync.com is following:`);
    userFollowingAnyCards.forEach((card, index) => {
      console.log(`${index + 1}. "${card.title}" (ID: ${card.id}) in ${card.board}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAllCards().then(() => {
  console.log('\n=== DEBUG COMPLETE ===');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});