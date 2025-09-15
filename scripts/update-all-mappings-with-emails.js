import { db } from '../lib/dynamodb.js';
import { logger } from '../lib/safe-logger.js';
import { ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { getTableName } from '../lib/dynamodb.js';

/**
 * Updates existing "All" mappings to include SA email addresses
 */
async function updateAllMappingsWithEmails() {
  try {
    logger.info('Starting update of All mappings with SA emails');
    
    // Get all SA to AM mappings
    const mappingsCommand = new ScanCommand({
      TableName: getTableName('SAToAMMappings')
    });
    
    const mappingsResult = await db.client.send(mappingsCommand);
    const allMappings = (mappingsResult.Items || []).map(item => ({
      id: item.id?.S || '',
      saName: item.sa_name?.S || '',
      saEmail: item.sa_email?.S || '',
      isAllMapping: item.is_all_mapping?.BOOL || false
    }));
    
    // Filter for "All" mappings without SA email
    const allMappingsWithoutEmail = allMappings.filter(mapping => 
      mapping.isAllMapping && !mapping.saEmail
    );
    
    logger.info('Found All mappings without SA email', { count: allMappingsWithoutEmail.length });
    
    if (allMappingsWithoutEmail.length === 0) {
      logger.info('No All mappings need updating');
      return;
    }
    
    // Get all users to lookup SA emails
    const usersCommand = new ScanCommand({
      TableName: getTableName('Users')
    });
    
    const usersResult = await db.client.send(usersCommand);
    const users = (usersResult.Items || []).map(item => ({
      name: item.name?.S || '',
      email: item.email?.S || ''
    }));
    
    logger.info('Retrieved users for email lookup', { userCount: users.length });
    
    let updatedCount = 0;
    let notFoundCount = 0;
    
    // Update each All mapping with SA email
    for (const mapping of allMappingsWithoutEmail) {
      // Find user by name
      const user = users.find(u => u.name === mapping.saName);
      
      if (user && user.email) {
        try {
          const updateCommand = new UpdateItemCommand({
            TableName: getTableName('SAToAMMappings'),
            Key: { id: { S: mapping.id } },
            UpdateExpression: 'SET sa_email = :email',
            ExpressionAttributeValues: {
              ':email': { S: user.email }
            }
          });
          
          await db.client.send(updateCommand);
          updatedCount++;
          
          logger.info('Updated All mapping with SA email', {
            mappingId: mapping.id,
            saName: mapping.saName,
            saEmail: user.email
          });
          
        } catch (error) {
          logger.error('Failed to update mapping', {
            mappingId: mapping.id,
            saName: mapping.saName,
            error: error.message
          });
        }
      } else {
        notFoundCount++;
        logger.warn('SA user not found for mapping', {
          mappingId: mapping.id,
          saName: mapping.saName
        });
      }
    }
    
    logger.info('All mappings update completed', {
      totalProcessed: allMappingsWithoutEmail.length,
      updated: updatedCount,
      notFound: notFoundCount
    });
    
  } catch (error) {
    logger.error('Error updating All mappings with emails', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Run the update if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  updateAllMappingsWithEmails()
    .then(() => {
      console.log('Update completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Update failed:', error.message);
      process.exit(1);
    });
}

export { updateAllMappingsWithEmails };