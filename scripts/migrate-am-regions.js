import { db } from '../lib/dynamodb.js';

async function migrateAccountManagerRegions() {
  try {
    console.log('Starting migration: Account managers without regions → staged status');
    
    const users = await db.getAllUsers();
    const accountManagers = users.filter(user => user.role === 'account_manager');
    
    let updatedCount = 0;
    
    for (const am of accountManagers) {
      if (!am.region && am.status !== 'staged') {
        await db.updateUser(am.email, { status: 'staged' });
        console.log(`Updated ${am.name} (${am.email}) to staged status`);
        updatedCount++;
      }
    }
    
    console.log(`Migration complete: ${updatedCount} account managers updated to staged status`);
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

migrateAccountManagerRegions();