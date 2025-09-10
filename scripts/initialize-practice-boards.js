import { db } from '../lib/dynamodb.js';

async function initializePracticeBoards() {
  try {
    console.log('🔍 Finding existing practice managers...');
    
    // Get all users with practice_manager role
    const allUsers = await db.getAllUsers();
    const practiceManagers = allUsers.filter(user => 
      user.role === 'practice_manager' && 
      user.practices && 
      user.practices.length > 0
    );
    
    console.log(`📊 Found ${practiceManagers.length} practice managers`);
    
    const results = [];
    
    for (const manager of practiceManagers) {
      try {
        console.log(`\n👤 Processing: ${manager.name} (${manager.email})`);
        console.log(`📋 Practices: ${manager.practices.join(', ')}`);
        
        // Create practice board ID from sorted practices
        const practiceId = manager.practices.sort().join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');
        console.log(`🆔 Practice ID: ${practiceId}`);
        
        // Check if board already exists
        const existingBoard = await db.getSetting(`practice_board_${practiceId}`);
        
        if (!existingBoard) {
          console.log('✨ Creating new practice board...');
          
          // Create new board with default columns
          const defaultBoard = {
            columns: [
              { id: '1', title: 'To Do', cards: [], createdBy: 'system', createdAt: new Date().toISOString() },
              { id: '2', title: 'In Progress', cards: [], createdBy: 'system', createdAt: new Date().toISOString() },
              { id: '3', title: 'Done', cards: [], createdBy: 'system', createdAt: new Date().toISOString() }
            ],
            practices: manager.practices,
            managerId: manager.email,
            createdAt: new Date().toISOString()
          };
          
          await db.saveSetting(`practice_board_${practiceId}`, JSON.stringify(defaultBoard));
          
          console.log('✅ Practice board created successfully');
          
          results.push({
            manager: manager.name,
            email: manager.email,
            practices: manager.practices,
            practiceId,
            status: 'created'
          });
        } else {
          console.log('ℹ️ Practice board already exists');
          
          results.push({
            manager: manager.name,
            email: manager.email,
            practices: manager.practices,
            practiceId,
            status: 'already_exists'
          });
        }
      } catch (error) {
        console.error(`❌ Error processing ${manager.name}:`, error.message);
        
        results.push({
          manager: manager.name,
          email: manager.email,
          practices: manager.practices,
          status: 'error',
          error: error.message
        });
      }
    }
    
    console.log('\n📊 INITIALIZATION SUMMARY:');
    console.log(`Total practice managers: ${practiceManagers.length}`);
    console.log(`Boards created: ${results.filter(r => r.status === 'created').length}`);
    console.log(`Boards already existed: ${results.filter(r => r.status === 'already_exists').length}`);
    console.log(`Errors: ${results.filter(r => r.status === 'error').length}`);
    
    if (results.filter(r => r.status === 'error').length > 0) {
      console.log('\n❌ ERRORS:');
      results.filter(r => r.status === 'error').forEach(result => {
        console.log(`- ${result.manager}: ${result.error}`);
      });
    }
    
    console.log('\n✅ Practice board initialization complete!');
    
  } catch (error) {
    console.error('❌ Fatal error during initialization:', error);
  }
}

// Run the initialization
initializePracticeBoards();