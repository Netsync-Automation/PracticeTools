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
      
      // Get all mappings to find SAs with "All" associations and check for existing individual mappings
      const allMappings = await this.getAllMappings();
      
      // Find unique SAs that have "All" mappings
      const sasWithAllMappings = new Map();
      
      allMappings
        .filter(mapping => mapping.isAllMapping)
        .forEach(mapping => {
          const saKey = mapping.saEmail || mapping.saName;
          if (!sasWithAllMappings.has(saKey)) {
            sasWithAllMappings.set(saKey, {
              saName: mapping.saName,
              saEmail: mapping.saEmail,
              practiceGroups: new Set()
            });
          }
          // Add practice group and practices combination
          sasWithAllMappings.get(saKey).practiceGroups.add(JSON.stringify({
            practiceGroupId: mapping.practiceGroupId,
            practices: mapping.practices
          }));
        });
      
      if (sasWithAllMappings.size === 0) {
        logger.info('No SAs with "All" mappings found');
        return;
      }
      
      logger.info('Found SAs with "All" mappings', { count: sasWithAllMappings.size });
      
      // Create individual mappings for each SA that has "All" associations
      const createdMappings = [];
      const timestamp = new Date().toISOString();
      const environment = getEnvironment();
      const tableName = getTableName('SAToAMMappings');
      
      for (const [saKey, saInfo] of sasWithAllMappings) {
        // Process each practice group + practices combination for this SA
        for (const practiceGroupData of saInfo.practiceGroups) {
          const { practiceGroupId, practices } = JSON.parse(practiceGroupData);
          
          // Check if individual mapping already exists for this SA-AM-Practices combination
          const mappingExists = allMappings.some(existing => {
            const saMatches = saInfo.saEmail 
              ? existing.saEmail === saInfo.saEmail
              : existing.saName === saInfo.saName;
            
            const practicesMatch = JSON.stringify(existing.practices) === JSON.stringify(practices);
            
            return saMatches &&
                   existing.amEmail === newAmUser.email &&
                   existing.isAllMapping === false &&
                   practicesMatch;
          });
        
          if (mappingExists) {
            logger.info('Mapping already exists, skipping', {
              saName: saInfo.saName,
              saEmail: saInfo.saEmail || 'missing',
              amName: newAmUser.name,
              amEmail: newAmUser.email,
              practices: practices
            });
            continue;
          }
          
          const mappingId = uuidv4();
          
          const command = new PutItemCommand({
            TableName: tableName,
            Item: {
              id: { S: mappingId },
              sa_name: { S: saInfo.saName },
              sa_email: { S: saInfo.saEmail || '' },
              am_name: { S: newAmUser.name },
              am_email: { S: newAmUser.email },
              region: { S: newAmUser.region || '' },
              practice_group_id: { S: practiceGroupId },
              practices: { S: JSON.stringify(practices || []) },
              is_all_mapping: { BOOL: false }, // Individual mapping, not "All"
              created_at: { S: timestamp },
              environment: { S: environment }
            }
          });
          
          await db.client.send(command);
          createdMappings.push({
            id: mappingId,
            saName: saInfo.saName,
            amName: newAmUser.name,
            practices: practices
          });
          
          logger.info('Created mapping for new AM', {
            mappingId,
            saName: saInfo.saName,
            amName: newAmUser.name,
            practices: practices
          });
        }
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
        saEmail: item.sa_email?.S || '',
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