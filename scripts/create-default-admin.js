#!/usr/bin/env node

import { db } from '../lib/dynamodb.js';

async function createDefaultAdmin() {
  console.log('Creating default admin user in DynamoDB...');
  
  try {
    // Check if admin already exists
    const existingAdmin = await db.getUser('admin@localhost');
    if (existingAdmin) {
      console.log('Default admin already exists in database');
      return;
    }
    
    // Create default admin user
    const success = await db.createOrUpdateUser(
      'admin@localhost',
      'Default Administrator', 
      'local',
      'admin',
      'P!7xZ@r4eL9w#Vu1Tq&',
      'system_default'
    );
    
    if (success) {
      console.log('✅ Default admin user created successfully');
      console.log('Email: admin@localhost');
      console.log('Password: P!7xZ@r4eL9w#Vu1Tq&');
      console.log('⚠️  Change the default password after first login!');
    } else {
      console.error('❌ Failed to create default admin user');
    }
  } catch (error) {
    console.error('Error creating default admin:', error);
  }
  
  // Setup WebEx integration
  try {
    const { setupWebexIntegration } = await import('./setup-webex.js');
    await setupWebexIntegration();
  } catch (error) {
    console.error('Error setting up WebEx integration:', error);
  }
}

// Run the function
createDefaultAdmin()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

export { createDefaultAdmin };