// Quick script to fix Mike's auth method and set password
const { db } = require('./lib/dynamodb.js');

async function fixMikeAuth() {
  const email = 'mike@irgriffin.com';
  const tempPassword = 'TempPass123!';
  
  console.log('Updating Mike to local auth...');
  
  // Update user to local auth with password
  const success = await db.updateUser(email, {
    auth_method: 'local',
    require_password_change: true
  });
  
  if (success) {
    console.log('✅ Auth method updated to local');
    
    // Set temporary password
    const passwordSet = await db.resetUserPassword(email, tempPassword);
    
    if (passwordSet) {
      console.log('✅ Temporary password set:', tempPassword);
      console.log('🔑 Mike can now login with:', email, '/', tempPassword);
      console.log('⚠️  He will be required to change password on first login');
    } else {
      console.log('❌ Failed to set password');
    }
  } else {
    console.log('❌ Failed to update auth method');
  }
}

fixMikeAuth().catch(console.error);