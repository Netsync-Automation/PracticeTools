// Quick fix script for mike@irgriffin.com user authentication issue
import { db } from './lib/dynamodb.js';
import bcrypt from 'bcryptjs';

async function fixMikeUser() {
  const email = 'mike@irgriffin.com';
  const tempPassword = 'TempPass123!'; // User should change this immediately
  
  try {
    console.log('🔧 Fixing user authentication for:', email);
    
    // Get current user
    const user = await db.getUser(email);
    if (!user) {
      console.log('❌ User not found:', email);
      return;
    }
    
    console.log('📋 Current user data:', {
      email: user.email,
      name: user.name,
      auth_method: user.auth_method,
      hasPassword: !!user.password,
      role: user.role
    });
    
    // Hash the temporary password
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    
    // Update user with correct auth method and password
    const success = await db.updateUser(email, {
      auth_method: 'local',
      require_password_change: true // Force password change on next login
    });
    
    if (success) {
      // Now update the password separately
      const passwordSuccess = await db.resetUserPassword(email, tempPassword);
      
      if (passwordSuccess) {
        console.log('✅ User fixed successfully!');
        console.log('📧 User can now login with:');
        console.log('   Email:', email);
        console.log('   Password:', tempPassword);
        console.log('⚠️  User will be required to change password on next login');
      } else {
        console.log('❌ Failed to set password');
      }
    } else {
      console.log('❌ Failed to update user');
    }
    
  } catch (error) {
    console.error('❌ Error fixing user:', error);
  }
}

// Run the fix
fixMikeUser().then(() => {
  console.log('🏁 Fix script completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fix script failed:', error);
  process.exit(1);
});