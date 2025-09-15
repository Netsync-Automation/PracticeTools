import { db } from './dynamodb.js';
import { logger } from './safe-logger.js';
import { PutItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { getTableName } from './dynamodb.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Utility to automatically create SA to AM mappings when new account managers are added
 */
export class SaMappingAutoCreator {
  
  /**
   * Creates SA to AM mappings for a new account manager based on existing "All" mappings
   * @param {string} amName - Name of the new account manager
   * @param {string} amEmail - Email of the new account manager
   */
  async createMappingsForNewAM(amName, amEmail) {
    try {
      logger.info('Creating SA mappings for new account manager', { amName, amEmail });
      
      // Get all existing "All" mappings
      const allMappings = await this.getAllMappings();
      logger.info('Found existing "All" mappings', { count: allMappings.length });
      
      if (allMappings.length === 0) {
        logger.info('No "All" mappings found, skipping auto-creation');
        return { success: true, created: 0 };
      }
      
      const createdMappings = [];
      const timestamp = new Date().toISOString();
      const environment = process.env.ENVIRONMENT === 'prod' ? 'prod' : 'dev';
      
      for (const mapping of allMappings) {
        const mappingId = uuidv4();
        
        const command = new PutItemCommand({
          TableName: getTableName('SAToAMMappings'),
          Item: {
            id: { S: mappingId },
            sa_name: { S: mapping.saName },
            am_name: { S: amName },
            region: { S: '' }, // No region for auto-created mappings
            practice_group_id: { S: mapping.practiceGroupId },
            practices: { S: JSON.stringify(mapping.practices) },
            is_all_mapping: { BOOL: true },
            created_at: { S: timestamp },
            environment: { S: environment }
          }
        });
        
        await db.client.send(command);
        createdMappings.push({
          id: mappingId,
          saName: mapping.saName,
          practices: mapping.practices,
          practiceGroupId: mapping.practiceGroupId
        });
        
        logger.info('Created SA mapping for new AM', {
          mappingId,
          saName: mapping.saName,
          amName,
          practices: mapping.practices
        });
      }
      
      logger.info('Completed SA mapping auto-creation for new AM', {
        amName,
        createdCount: createdMappings.length
      });
      
      return { success: true, created: createdMappings.length, mappings: createdMappings };
      
    } catch (error) {
      logger.error('Error creating SA mappings for new AM', {
        amName,
        amEmail,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Gets all "All" mappings from the database
   * @returns {Promise<Array>} Array of "All" mappings
   */
  async getAllMappings() {
    try {
      const command = new ScanCommand({
        TableName: getTableName('SAToAMMappings'),
        FilterExpression: 'is_all_mapping = :isAll',
        ExpressionAttributeValues: {
          ':isAll': { BOOL: true }
        }
      });
      
      const result = await db.client.send(command);
      
      // Group by SA and practice group to get unique combinations
      const uniqueMappings = new Map();
      
      (result.Items || []).forEach(item => {
        const saName = item.sa_name?.S || '';
        const practiceGroupId = item.practice_group_id?.S || '';
        const practices = JSON.parse(item.practices?.S || '[]');
        
        const key = `${saName}-${practiceGroupId}`;
        
        if (!uniqueMappings.has(key)) {
          uniqueMappings.set(key, {
            saName,
            practiceGroupId,
            practices
          });
        }
      });
      
      return Array.from(uniqueMappings.values());
      
    } catch (error) {
      logger.error('Error getting "All" mappings', { error: error.message });
      return [];
    }
  }
}

// Export singleton instance
export const saMappingAutoCreator = new SaMappingAutoCreator();