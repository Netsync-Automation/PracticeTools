// Script to add Feature Request issue type to database
import { db } from '../lib/dynamodb.js';

async function addFeatureRequestType() {
  try {
    console.log('Adding Feature Request issue type...');
    
    const featureRequestType = {
      name: 'Feature Request',
      icon: '✨',
      description: 'Request for new features or enhancements',
      active: true,
      created_at: new Date().toISOString()
    };
    
    await db.createIssueType(featureRequestType);
    console.log('✅ Feature Request issue type added successfully');
    
    // Verify it was added
    const issueTypes = await db.getIssueTypes();
    console.log('Current issue types:');
    issueTypes.forEach(type => {
      console.log(`  - ${type.icon} ${type.name}`);
    });
    
  } catch (error) {
    console.error('❌ Error adding Feature Request type:', error);
  }
}

addFeatureRequestType();