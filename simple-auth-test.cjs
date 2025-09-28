// Simple authentication test for mike@irgriffin.com
const { db } = require('./lib/dynamodb.js');

async function simpleAuthTest() {
  const email = 'mike@irgriffin.com';
  
  // Force production environment
  process.env.ENVIRONMENT = 'prod';
  
  try {
    console.log('🔐 Simple authentication test for:', email);
    console.log('🌍 Environment:', process.env.ENVIRONMENT);
    
    // Get user from database
    const user = await db.getUser(email);
    
    if (!user) {
      console.log('❌ User not found in database');
      return;
    }
    
    console.log('✅ User found in database');
    console.log('📊 User summary:');
    console.log('   Email:', user.email);
    console.log('   Auth Method:', user.auth_method);
    console.log('   Has Password:', !!user.password);
    console.log('   Role:', user.role);
    console.log('   Practices:', user.practices);
    console.log('   Status:', user.status);
    
    // Check if user data is valid for authentication
    if (user.auth_method === 'local' && user.password && user.status === 'active') {
      console.log('✅ User data is valid for local authentication');
    } else {
      console.log('❌ User data has issues:');
      if (user.auth_method !== 'local') console.log('   - Auth method is not local:', user.auth_method);
      if (!user.password) console.log('   - No password hash found');
      if (user.status !== 'active') console.log('   - User status is not active:', user.status);
    }
    
    // Check board permissions
    console.log('\n🏢 Checking board permissions...');
    const boards = await db.getAllPracticeBoards();
    const collaborationBoard = boards.find(board => 
      board.practices && board.practices.includes('Collaboration')
    );
    
    if (collaborationBoard) {
      console.log('✅ Found Collaboration board:', collaborationBoard.practiceId);
      console.log('   Board practices:', collaborationBoard.practices);
      
      const canEdit = user.practices && collaborationBoard.practices &&
        collaborationBoard.practices.some(practice => user.practices.includes(practice));
      
      console.log('   Can edit:', canEdit);
      
      if (canEdit) {
        console.log('✅ User should be able to edit cards on this board');
      } else {
        console.log('❌ User should NOT be able to edit cards on this board');
      }
    } else {
      console.log('❌ No Collaboration board found');
    }
    
  } catch (error) {
    console.error('❌ Error in authentication test:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
simpleAuthTest().then(() => {
  console.log('\n🏁 Simple authentication test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Simple authentication test failed:', error);
  process.exit(1);
});