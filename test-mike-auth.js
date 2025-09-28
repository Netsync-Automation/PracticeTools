// Test authentication flow for mike@irgriffin.com
import { AuthHandler } from './lib/auth-handler.js';
import { validateUserSession } from './lib/auth-check.js';

async function testMikeAuth() {
  const email = 'mike@irgriffin.com';
  
  // Force production environment
  process.env.ENVIRONMENT = 'prod';
  
  try {
    console.log('🔐 Testing authentication flow for:', email);
    console.log('🌍 Environment:', process.env.ENVIRONMENT);
    
    // Test 1: Try to authenticate with a test password
    console.log('\n🧪 Test 1: Authentication with password');
    console.log('Note: We don\'t know the actual password, so this will likely fail');
    const authResult = await AuthHandler.authenticateUser(email, 'testpassword');
    console.log('Auth result:', authResult);
    
    // Test 2: Create a mock user session cookie and validate it
    console.log('\n🧪 Test 2: Session validation with mock cookie');
    
    // Create a mock user session (simulating what would be in the cookie)
    const mockUser = {
      email: 'mike@irgriffin.com',
      name: 'mike duff',
      role: 'practice_member',
      auth_method: 'local',
      practices: ['Collaboration'],
      isAdmin: false
    };
    
    const mockCookie = {
      value: JSON.stringify(mockUser)
    };
    
    console.log('Mock cookie data:', JSON.stringify(mockUser, null, 2));
    
    const sessionValidation = await validateUserSession(mockCookie);
    console.log('Session validation result:', {
      valid: sessionValidation.valid,
      error: sessionValidation.error,
      userEmail: sessionValidation.user?.email,
      userRole: sessionValidation.user?.role,
      userPractices: sessionValidation.user?.practices
    });
    
    if (sessionValidation.valid) {
      console.log('✅ Session validation successful');
      
      // Test 3: Check board edit permissions
      console.log('\n🧪 Test 3: Board edit permissions check');
      const user = sessionValidation.user;
      const practiceId = 'audiovisual-collaboration-contactcenter-iot-physicalsecurity';
      
      console.log('User practices:', user.practices);
      console.log('User role:', user.role);
      console.log('Is admin:', user.isAdmin);
      
      // Simulate the permission check from the API
      if (!user.isAdmin) {
        console.log('User is not admin, checking practice permissions...');
        
        // This would normally fetch board data, but we know from previous check
        const boardPractices = ['Audio/Visual', 'Collaboration', 'Contact Center', 'IoT', 'Physical Security'];
        console.log('Board practices:', boardPractices);
        
        const canEdit = boardPractices && user.practices && 
          boardPractices.some(practice => user.practices.includes(practice));
        
        console.log('Can edit board:', canEdit);
        
        if (canEdit) {
          console.log('✅ User should be able to edit the board');
        } else {
          console.log('❌ User should NOT be able to edit the board');
        }
      } else {
        console.log('✅ User is admin, can edit any board');
      }
    } else {
      console.log('❌ Session validation failed:', sessionValidation.error);
    }
    
  } catch (error) {
    console.error('❌ Error testing authentication:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testMikeAuth().then(() => {
  console.log('\n🏁 Authentication test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Authentication test failed:', error);
  process.exit(1);
});