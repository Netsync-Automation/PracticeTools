import { DynamoDBService } from './lib/dynamodb.js';

async function checkFollowers() {
  const db = new DynamoDBService();
  
  console.log('=== DEBUGGING FOLLOWERS FOR "Fort Worth Singlewire" ===');
  
  try {
    // First, let's get all practice boards to find the Fort Worth Singlewire card
    console.log('\n1. Getting all practice boards...');
    const boards = await db.getAllPracticeBoards();
    console.log(`Found ${boards.length} practice boards`);
    
    let fortWorthCard = null;
    let boardWithCard = null;
    
    // Search through all boards for the Fort Worth Singlewire card
    for (const board of boards) {
      console.log(`\nChecking board for practices: ${board.practices.join(', ')}`);
      
      // Get the board data from Settings table
      const boardKey = `dev_practice_board_${board.practiceId}`;
      const boardData = await db.getSetting(boardKey);
      
      if (boardData) {
        const parsedBoard = JSON.parse(boardData);
        console.log(`Board has ${parsedBoard.columns?.length || 0} columns`);
        
        // Search through columns for the card
        if (parsedBoard.columns) {
          for (const column of parsedBoard.columns) {
            if (column.cards) {
              for (const card of column.cards) {
                if (card.title && card.title.includes('Fort Worth Singlewire')) {
                  console.log(`\n🎯 FOUND CARD: "${card.title}"`);
                  console.log(`Card ID: ${card.id}`);
                  console.log(`Card followers:`, card.followers || []);
                  console.log(`Followers count: ${(card.followers || []).length}`);
                  
                  fortWorthCard = card;
                  boardWithCard = board;
                  break;
                }
              }
            }
            if (fortWorthCard) break;
          }
        }
        if (fortWorthCard) break;
      }
    }
    
    if (!fortWorthCard) {
      console.log('\n❌ Could not find "Fort Worth Singlewire" card in any practice board');
      return;
    }
    
    console.log(`\n2. Found card in board for practices: ${boardWithCard.practices.join(', ')}`);
    console.log(`Card followers array:`, fortWorthCard.followers);
    
    // Check if mbgriffin@netsync.com is in the followers
    const targetEmail = 'mbgriffin@netsync.com';
    const isFollowing = fortWorthCard.followers && fortWorthCard.followers.includes(targetEmail);
    
    console.log(`\n3. Is ${targetEmail} following this card?`, isFollowing);
    
    if (isFollowing) {
      console.log('✅ User IS in the followers array in the database');
    } else {
      console.log('❌ User is NOT in the followers array in the database');
      console.log('Current followers:', fortWorthCard.followers || []);
    }
    
    // Also check the Issues Followers table to see if there are any follow records
    console.log('\n4. Checking Issues Followers table...');
    try {
      const issueFollowers = await db.getUserFollows(targetEmail);
      console.log(`Found ${issueFollowers.length} issue follow records for ${targetEmail}`);
      
      if (issueFollowers.length > 0) {
        console.log('Issue follow records:', issueFollowers);
      }
    } catch (error) {
      console.log('Error checking issue followers:', error.message);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkFollowers().then(() => {
  console.log('\n=== DEBUG COMPLETE ===');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});