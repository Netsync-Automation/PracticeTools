import { db } from './dynamodb.js';
import { logger } from './safe-logger.js';
import { ScanCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { getTableName, getEnvironment } from './dynamodb.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Auto-creates SA to AM mappings for new Account Managers based on existing "All" mappings
 */
export class AutoMappingUtility {
  
  /**
   * Creates mappings for new Account Managers based on existing "All" mappings
   * @param {string} newAmEmail - Email of the newly created Account Manager
   */
  async createMappingsForNewAM(newAmEmail) {
    try {
      logger.info('Creating mappings for new Account Manager', { newAmEmail });
      
      // Get the new AM user details
      const newAmUser = await db.getUser(newAmEmail);
      if (!newAmUser || newAmUser.role !== 'account_manager') {
        logger.info('User not found or not an Account Manager', { newAmEmail });
        return;
      }
      
      // Get all existing "All" mappings
      const allMappings = await this.getAllMappings();
      const allTypeMappings = allMappings.filter(mapping => mapping.isAllMapping);
      
      if (allTypeMappings.length === 0) {
        logger.info('No "All" type mappings found');
        return;
      }
      
      logger.info('Found "All" type mappings', { count: allTypeMappings.length });
      
      // Check for existing mappings to avoid duplicates
      const existingMappings = allMappings.filter(mapping => 
        mapping.amEmail === newAmUser.email && !mapping.isAllMapping
      );
      
      // Create individual mappings for each "All" mapping that doesn't already exist
      const createdMappings = [];
      const timestamp = new Date().toISOString();
      const environment = getEnvironment();
      const tableName = getTableName('SAToAMMappings');
      
      for (const allMapping of allTypeMappings) {
        // Check if mapping already exists for this SA-AM-Practice combination
        const mappingExists = existingMappings.some(existing => 
          existing.saName === allMapping.saName &&
          existing.amEmail === newAmUser.email &&
          JSON.stringify(existing.practices) === JSON.stringify(allMapping.practices)
        );
        
        if (mappingExists) {
          logger.info('Mapping already exists, skipping', {
            saName: allMapping.saName,
            amName: newAmUser.name,
            practices: allMapping.practices
          });
          continue;
        }
        
        const mappingId = uuidv4();
        
        const command = new PutItemCommand({
          TableName: tableName,
          Item: {
            id: { S: mappingId },
            sa_name: { S: allMapping.saName },
            am_name: { S: newAmUser.name },
            am_email: { S: newAmUser.email },
            region: { S: newAmUser.region || '' },
            practice_group_id: { S: allMapping.practiceGroupId },
            practices: { S: JSON.stringify(allMapping.practices || []) },
            is_all_mapping: { BOOL: false }, // Individual mapping, not "All"
            created_at: { S: timestamp },
            environment: { S: environment }
          }
        });
        
        await db.client.send(command);
        createdMappings.push({
          id: mappingId,
          saName: allMapping.saName,
          amName: newAmUser.name,
          practices: allMapping.practices
        });
        
        logger.info('Created mapping for new AM', {
          mappingId,
          saName: allMapping.saName,
          amName: newAmUser.name,
          practices: allMapping.practices
        });
      }
      
      logger.info('Auto-mapping completed for new Account Manager', {
        newAmEmail,
        createdCount: createdMappings.length
      });
      
      return createdMappings;
      
    } catch (error) {
      logger.error('Error creating mappings for new Account Manager', {
        newAmEmail,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Gets all SA to AM mappings from database
   */
  async getAllMappings() {
    try {
      const command = new ScanCommand({
        TableName: getTableName('SAToAMMappings')
      });
      
      const result = await db.client.send(command);
      const mappings = (result.Items || []).map(item => ({
        id: item.id?.S || '',
        saName: item.sa_name?.S || '',
        amName: item.am_name?.S || '',
        amEmail: item.am_email?.S || '',
        region: item.region?.S || '',
        practices: JSON.parse(item.practices?.S || '[]'),
        practiceGroupId: item.practice_group_id?.S || '',
        isAllMapping: item.is_all_mapping?.BOOL || false,
        created_at: item.created_at?.S || ''
      }));
      
      return mappings;
      
    } catch (error) {
      logger.error('Error retrieving SA to AM mappings', {
        error: error.message
      });
      return [];
    }
  }
}

// Export singleton instance
export const autoMappingUtility = new AutoMappingUtility();