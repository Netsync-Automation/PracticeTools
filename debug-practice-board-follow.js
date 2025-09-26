const { db, getEnvironment } = require('./lib/dynamodb.js');

async function debugPracticeBoardFollow() {
  console.log('=== DEBUGGING PRACTICE BOARD FOLLOW FUNCTIONALITY ===');
  
  const testEmail = 'mbgriffin@netsync.com';
  const testPracticeId = 'singlewire'; // Assuming this is the practice ID for Singlewire cards
  const testTopic = 'Main Topic';
  
  console.log(`\n--- Testing Practice Board: ${testPracticeId} ---`);
  console.log(`Topic: ${testTopic}`);
  console.log(`User: ${testEmail}`);
  
  // Get the board key (same logic as the API)
  const environment = getEnvironment();
  const boardKey = testTopic === 'Main Topic' 
    ? `${environment}_practice_board_${testPracticeId}` 
    : `${environment}_practice_board_${testPracticeId}_${testTopic.replace(/[^a-zA-Z0-9]/g, '_')}`;
  
  console.log(`\nBoard Key: ${boardKey}`);
  
  // Get the board data
  const boardData = await db.getSetting(boardKey);
  
  if (!boardData) {
    console.log('❌ No board data found');
    return;
  }
  
  console.log('✅ Board data found');
  
  try {
    const parsed = JSON.parse(boardData);
    console.log(`\nBoard structure:`);
    console.log(`- Columns: ${parsed.columns?.length || 0}`);
    
    if (parsed.columns) {
      parsed.columns.forEach((column, colIndex) => {
        console.log(`\nColumn ${colIndex + 1}: "${column.title}"`);
        console.log(`- Cards: ${column.cards?.length || 0}`);
        
        if (column.cards) {
          column.cards.forEach((card, cardIndex) => {
            console.log(`  Card ${cardIndex + 1}: "${card.title}"`);
            console.log(`  - Followers: ${JSON.stringify(card.followers || [])}`);
            console.log(`  - Is user following: ${(card.followers || []).includes(testEmail)}`);
            console.log(`  - Created by: ${card.createdBy}`);
            console.log(`  - Created at: ${card.createdAt}`);
          });
        }
      });
    }
    
    // Check if there are any cards with the test user as a follower
    let totalCards = 0;
    let cardsWithFollowers = 0;
    let cardsUserIsFollowing = 0;
    
    if (parsed.columns) {
      parsed.columns.forEach(column => {
        if (column.cards) {
          column.cards.forEach(card => {
            totalCards++;
            if (card.followers && card.followers.length > 0) {
              cardsWithFollowers++;
            }
            if (card.followers && card.followers.includes(testEmail)) {
              cardsUserIsFollowing++;
            }
          });
        }
      });
    }
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total cards: ${totalCards}`);
    console.log(`Cards with followers: ${cardsWithFollowers}`);
    console.log(`Cards user is following: ${cardsUserIsFollowing}`);
    
    if (cardsUserIsFollowing === 0 && totalCards > 0) {
      console.log(`\n❌ ISSUE CONFIRMED: User ${testEmail} is not following any cards`);
      console.log(`This matches the reported issue where users think they're following but database shows empty arrays`);
    } else if (cardsUserIsFollowing > 0) {
      console.log(`\n✅ User is following ${cardsUserIsFollowing} cards - follow functionality appears to be working`);
    }
    
  } catch (error) {
    console.error('❌ Error parsing board data:', error);
    console.log('Raw board data:', boardData.substring(0, 500) + '...');
  }
}

debugPracticeBoardFollow().catch(console.error);