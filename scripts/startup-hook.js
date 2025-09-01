#!/usr/bin/env node

const { processPendingRelease } = require('./deploy-hook');

async function runStartupTasks() {
  console.log('\n🚀 === STARTUP TASKS INITIATED ===');
  console.log('📅 Start time:', new Date().toISOString());
  console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
  console.log('📁 Working directory:', process.cwd());
  
  try {
    // Process any pending releases
    console.log('\n🔄 Processing pending releases...');
    const processed = await processPendingRelease();
    console.log('📊 Pending release result:', processed);
    
    if (processed) {
      console.log('✅ Pending release processed successfully');
    } else {
      console.log('ℹ️ No pending releases to process');
    }
  } catch (error) {
    console.error('\n💥 Error in startup tasks:', error);
    console.error('📍 Error stack:', error.stack);
  }
  
  console.log('\n✅ === STARTUP TASKS COMPLETED ===');
  console.log('📅 End time:', new Date().toISOString());
}

// Run startup tasks
runStartupTasks();