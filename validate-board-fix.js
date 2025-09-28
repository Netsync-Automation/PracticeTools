import { db, getEnvironment } from './lib/dynamodb.js';
import { validateUserSession } from './lib/auth-check.js';

// Force production environment
process.env.ENVIRONMENT = 'prod';

async function validateBoardFix() {
  try {
    console.log('🔍 Validating board permissions fix...');
    console.log('Environment:', getEnvironment());
    
    // Simulate the exact same conditions from the failed request
    const mockUserCookie = {
      value: decodeURIComponent('%7B%22email%22%3A%22mike%40irgriffin.com%22%2C%22name%22%3A%22mike%20duff%22%2C%22role%22%3A%22practice_member%22%2C%22auth_method%22%3A%22local%22%2C%22isAdmin%22%3Afalse%2C%22created_at%22%3A%222025-09-28T16%3A14%3A25.235Z%22%2C%22last_login%22%3A%222025-09-28T17%3A04%3A16.521Z%22%7D')
    };
    
    console.log('🔐 Testing user session validation...');
    const validation = await validateUserSession(mockUserCookie);
    
    if (!validation.valid) {
      console.log('❌ User validation failed:', validation.error);
      return false;
    }
    
    console.log('✅ User validation passed');
    console.log('👤 User details:', {
      email: validation.user?.email,
      isAdmin: validation.user?.isAdmin,
      role: validation.user?.role,
      practices: validation.user?.practices
    });
    
    // Test board permissions check
    const practiceId = 'audiovisual-collaboration-contactcenter-iot-physicalsecurity';
    const topic = 'Pre-Sales';
    const user = validation.user;
    
    console.log('🏢 Testing board permissions...');
    
    if (!user.isAdmin) {
      console.log('👤 User is not admin, checking board permissions');
      
      const environment = getEnvironment();
      const boardKey = topic === 'Main Topic' 
        ? `${environment}_practice_board_${practiceId}` 
        : `${environment}_practice_board_${practiceId}_${topic.replace(/[^a-zA-Z0-9]/g, '_')}`;
      
      console.log('🔑 Board key:', boardKey);
      const existingData = await db.getSetting(boardKey);
      console.log('📊 Board data found:', !!existingData);
      
      if (existingData) {
        const boardData = JSON.parse(existingData);
        console.log('📋 Board practices:', boardData.practices);
        
        const canEdit = boardData.practices && user.practices && 
          boardData.practices.some(practice => user.practices.includes(practice));
        console.log('✅ Can edit board:', canEdit);
        
        if (!canEdit) {
          console.log('❌ VALIDATION FAILED: User cannot edit this board - insufficient permissions');
          return false;
        } else {
          console.log('✅ VALIDATION PASSED: User can edit this board');
          return true;
        }
      } else {
        console.log('❌ VALIDATION FAILED: Board data not found');
        return false;
      }
    } else {
      console.log('✅ User is admin - would have full access');
      return true;
    }
    
  } catch (error) {
    console.error('❌ Validation error:', error);
    return false;
  }
}

console.log('🚀 Starting board permissions validation...');
validateBoardFix().then(success => {
  if (success) {
    console.log('\n🎉 VALIDATION SUCCESSFUL: The board permissions fix is working correctly!');
    console.log('✅ mike@irgriffin.com should now be able to edit cards on the practice information page.');
  } else {
    console.log('\n💥 VALIDATION FAILED: The fix did not resolve the issue.');
  }
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('\n💥 VALIDATION ERROR:', error);
  process.exit(1);
});