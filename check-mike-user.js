// Check mike@irgriffin.com user data in production
import { db } from './lib/dynamodb.js';

async function checkMikeUser() {
  const email = 'mike@irgriffin.com';
  
  try {
    console.log('🔍 Checking user data for:', email);
    console.log('🌍 Environment:', process.env.ENVIRONMENT || 'dev');
    console.log('📊 Table name will be:', `PracticeTools-${process.env.ENVIRONMENT === 'prod' ? 'prod' : 'dev'}-Users`);
    
    // Get current user
    const user = await db.getUser(email);
    
    if (!user) {
      console.log('❌ User not found:', email);
      return;
    }
    
    console.log('📋 Complete user data:');
    console.log(JSON.stringify(user, null, 2));
    
    console.log('\n📊 User summary:');
    console.log('   Email:', user.email);
    console.log('   Name:', user.name);
    console.log('   Role:', user.role);
    console.log('   Auth Method:', user.auth_method);
    console.log('   Has Password:', !!user.password);
    console.log('   Is Admin:', user.isAdmin);
    console.log('   Practices:', user.practices);
    console.log('   Status:', user.status);
    console.log('   Created From:', user.created_from);
    console.log('   Created At:', user.created_at);
    console.log('   Last Login:', user.last_login);
    console.log('   Require Password Change:', user.require_password_change);
    
    // Check if this explains the authentication issue
    if (user.auth_method !== 'local' && user.password) {
      console.log('\n⚠️  ISSUE IDENTIFIED: User has password but auth_method is not "local"');
    }
    
    if (user.auth_method === 'local' && !user.password) {
      console.log('\n⚠️  ISSUE IDENTIFIED: User has local auth_method but no password hash');
    }
    
    if (user.auth_method === 'saml' && user.password) {
      console.log('\n⚠️  ISSUE IDENTIFIED: User has SAML auth_method but also has a password (conflicting auth methods)');
    }
    
  } catch (error) {
    console.error('❌ Error checking user:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the check
checkMikeUser().then(() => {
  console.log('\n🏁 User check completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 User check failed:', error);
  process.exit(1);
});