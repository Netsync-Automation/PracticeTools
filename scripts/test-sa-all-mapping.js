import { saMappingAutoCreator } from '../lib/sa-mapping-auto-creator.js';
import { db } from '../lib/dynamodb.js';

/**
 * Test script for SA "All" mapping functionality
 */

async function testSaAllMapping() {
  try {
    console.log('🧪 Starting SA "All" Mapping Test');
    console.log('==================================');
    
    // Test 1: Get all account managers
    console.log('\n📋 Test 1: Fetching account managers...');
    const users = await db.getAllUsers();
    const accountManagers = users.filter(user => user.role === 'account_manager');
    console.log(`Found ${accountManagers.length} account managers:`);
    accountManagers.forEach(am => {
      console.log(`  - ${am.name} (${am.email})`);
    });
    
    if (accountManagers.length === 0) {
      console.log('❌ No account managers found. Please create some test data first.');
      return;
    }
    
    // Test 2: Test auto-creation for new AM
    console.log('\n🎯 Test 2: Testing auto-creation for new AM...');
    const testAm = { name: 'Test AM', email: 'testam@netsync.com' };
    
    const result = await saMappingAutoCreator.createMappingsForNewAM(testAm.name, testAm.email);
    
    console.log('📊 Auto-creation Result:');
    console.log(`  - Success: ${result.success}`);
    console.log(`  - Created: ${result.created || 0} mappings`);
    
    if (result.success && result.created > 0) {
      console.log('  - Created mappings:');
      result.mappings.forEach(mapping => {
        console.log(`    * SA: ${mapping.saName}, Practices: ${mapping.practices.join(', ')}`);
      });
    }
    
    // Test 3: Get "All" mappings
    console.log('\n📊 Test 3: Checking "All" mappings...');
    const allMappings = await saMappingAutoCreator.getAllMappings();
    console.log(`Found ${allMappings.length} unique "All" mapping templates:`);
    allMappings.forEach(mapping => {
      console.log(`  - SA: ${mapping.saName}, Practices: ${mapping.practices.join(', ')}, Group: ${mapping.practiceGroupId}`);
    });
    
    console.log('\n🎉 SA "All" Mapping Test Complete!');
    console.log('==================================');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testSaAllMapping();