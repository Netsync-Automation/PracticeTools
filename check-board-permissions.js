// Check board permissions for mike@irgriffin.com
import { db } from './lib/dynamodb.js';

async function checkBoardPermissions() {
  const email = 'mike@irgriffin.com';
  
  // Force production environment
  process.env.ENVIRONMENT = 'prod';
  
  try {
    console.log('🔍 Checking board permissions for:', email);
    console.log('🌍 Environment:', process.env.ENVIRONMENT);
    
    // Get user data
    const user = await db.getUser(email);
    if (!user) {
      console.log('❌ User not found:', email);
      return;
    }
    
    console.log('👤 User practices:', user.practices);
    console.log('🎭 User role:', user.role);
    console.log('👑 Is Admin:', user.isAdmin);
    
    // Get all practice boards
    console.log('\n📋 Checking available practice boards...');
    const boards = await db.getAllPracticeBoards();
    console.log('📊 Found', boards.length, 'practice boards');
    
    for (const board of boards) {
      console.log(`\n🏢 Board: ${board.practiceId}`);
      console.log('   Practices:', board.practices);
      console.log('   Manager ID:', board.managerId);
      
      // Check if user can edit this board
      const canEdit = user.isAdmin || 
        (user.practices && board.practices && 
         board.practices.some(practice => user.practices.includes(practice)));
      
      console.log('   ✏️  Can Edit:', canEdit);
      
      if (canEdit) {
        console.log('   ✅ User has permission to edit this board');
      } else {
        console.log('   ❌ User does NOT have permission to edit this board');
        console.log('   🔍 User practices:', user.practices);
        console.log('   🔍 Board practices:', board.practices);
        console.log('   🔍 Overlap:', user.practices?.filter(p => board.practices?.includes(p)));
      }
    }
    
    // Check specific Collaboration board
    console.log('\n🎯 Checking Collaboration board specifically...');
    const collaborationBoards = boards.filter(board => 
      board.practices && board.practices.includes('Collaboration')
    );
    
    if (collaborationBoards.length === 0) {
      console.log('❌ No Collaboration practice board found!');
    } else {
      console.log('✅ Found', collaborationBoards.length, 'Collaboration board(s)');
      collaborationBoards.forEach((board, index) => {
        console.log(`   Board ${index + 1}: ${board.practiceId}`);
        console.log('   Practices:', board.practices);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking board permissions:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the check
checkBoardPermissions().then(() => {
  console.log('\n🏁 Board permissions check completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Board permissions check failed:', error);
  process.exit(1);
});