// Fix existing users who were created with wrong auth method
const { db } = require('./lib/dynamodb.js');

async function fixExistingUsers() {
  console.log('Checking for users with wrong auth method...');
  
  // Get all users
  const users = await db.getAllUsers();
  
  // Find users who should be local but are marked as saml
  const usersToFix = users.filter(user => 
    user.auth_method === 'saml' && 
    user.password && 
    user.password.length > 0
  );
  
  console.log(`Found ${usersToFix.length} users to fix:`, usersToFix.map(u => u.email));
  
  for (const user of usersToFix) {
    console.log(`Fixing ${user.email}...`);
    
    const success = await db.updateUser(user.email, {
      auth_method: 'local'
    });
    
    if (success) {
      console.log(`✅ Fixed ${user.email}`);
    } else {
      console.log(`❌ Failed to fix ${user.email}`);
    }
  }
}

fixExistingUsers().catch(console.error);