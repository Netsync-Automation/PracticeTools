import { autoMappingUtility } from '../lib/auto-mapping-utility.js';

async function createAutoMappings() {
  const amEmails = ['jpendrich@netsync.com', 'xtrevino@netsync.com'];
  
  for (const amEmail of amEmails) {
    try {
      console.log(`Creating mappings for ${amEmail}...`);
      const createdMappings = await autoMappingUtility.createMappingsForNewAM(amEmail);
      console.log(`✓ Created ${createdMappings?.length || 0} mappings for ${amEmail}`);
    } catch (error) {
      console.error(`✗ Failed to create mappings for ${amEmail}:`, error.message);
    }
  }
  
  console.log('Auto-mapping process completed');
  process.exit(0);
}

createAutoMappings().catch(console.error);