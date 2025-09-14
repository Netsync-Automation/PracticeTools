import { db } from '../lib/dynamodb.js';
import { ScanCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { getTableName } from '../lib/dynamodb.js';

async function cleanupDuplicateMappings() {
  try {
    console.log('Scanning for duplicate mappings...');
    
    const command = new ScanCommand({
      TableName: getTableName('SAToAMMappings')
    });
    
    const result = await db.client.send(command);
    const mappings = (result.Items || []).map(item => ({
      id: item.id?.S || '',
      saName: item.sa_name?.S || '',
      amName: item.am_name?.S || '',
      amEmail: item.am_email?.S || '',
      practices: JSON.parse(item.practices?.S || '[]'),
      isAllMapping: item.is_all_mapping?.BOOL || false,
      created_at: item.created_at?.S || ''
    }));
    
    console.log(`Found ${mappings.length} total mappings`);
    
    // Group mappings by SA-AM-Practice combination
    const groups = {};
    mappings.forEach(mapping => {
      if (!mapping.isAllMapping) { // Only check individual mappings
        const key = `${mapping.saName}|${mapping.amEmail}|${JSON.stringify(mapping.practices)}`;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(mapping);
      }
    });
    
    // Find duplicates and keep only the oldest one
    let deletedCount = 0;
    for (const [key, group] of Object.entries(groups)) {
      if (group.length > 1) {
        console.log(`Found ${group.length} duplicates for: ${key}`);
        
        // Sort by created_at to keep the oldest
        group.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        
        // Delete all but the first (oldest)
        for (let i = 1; i < group.length; i++) {
          const deleteCommand = new DeleteItemCommand({
            TableName: getTableName('SAToAMMappings'),
            Key: { id: { S: group[i].id } }
          });
          
          await db.client.send(deleteCommand);
          console.log(`Deleted duplicate mapping: ${group[i].id}`);
          deletedCount++;
        }
      }
    }
    
    console.log(`Cleanup completed. Deleted ${deletedCount} duplicate mappings.`);
    process.exit(0);
    
  } catch (error) {
    console.error('Error cleaning up duplicates:', error);
    process.exit(1);
  }
}

cleanupDuplicateMappings();