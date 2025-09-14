import { db } from './dynamodb.js';
import { logger } from './safe-logger.js';
import { ScanCommand } from '@aws-sdk/client-dynamodb';

/**
 * Auto-assignment utility for SA assignments based on SA to AM Mapping
 * Matches SA assignments to SAs based on AM and Practice(s) from the mapping database
 */
export class SaAutoAssignment {
  
  /**
   * Attempts to automatically assign SAs to an SA assignment
   * @param {string} saAssignmentId - The SA assignment ID to process
   * @returns {Promise<{success: boolean, assignedSas: Array, region: string, message: string}>}
   */
  async processAutoAssignment(saAssignmentId) {
    try {
      logger.info('Starting SA auto-assignment process', { saAssignmentId });
      
      // Get the SA assignment
      const saAssignment = await db.getSaAssignmentById(saAssignmentId);
      if (!saAssignment) {
        return { success: false, assignedSas: [], region: '', message: 'SA assignment not found' };
      }
      
      logger.info('Processing SA assignment', {
        saAssignmentId,
        am: saAssignment.am,
        practice: saAssignment.practice,
        status: saAssignment.status
      });
      
      // Check if AM and Practice are available
      if (!saAssignment.am || !saAssignment.practice) {
        logger.info('SA assignment missing AM or Practice - skipping auto-assignment', {
          saAssignmentId,
          hasAm: !!saAssignment.am,
          hasPractice: !!saAssignment.practice
        });
        return { 
          success: false, 
          assignedSas: [], 
          region: '', 
          message: 'AM and/or Practice not identified - processing normally' 
        };
      }
      
      // Parse practices (could be comma-separated or array)
      const practices = this.parsePractices(saAssignment.practice);
      logger.info('Parsed practices from SA assignment', { practices });
      
      // Check which practices are already covered by existing SA assignments
      const uncoveredPractices = await this.getUncoveredPractices(saAssignment, practices);
      logger.info('Uncovered practices needing assignment', { uncoveredPractices });
      
      if (uncoveredPractices.length === 0) {
        logger.info('All practices already have SA assignments', { saAssignmentId });
        return {
          success: true,
          assignedSas: [],
          region: saAssignment.region || '',
          message: 'All practices already have SA assignments'
        };
      }
      
      // Get SA to AM mappings for this AM and uncovered practices only
      const matchingSas = await this.findMatchingSAs(saAssignment.am, uncoveredPractices);
      
      if (matchingSas.length === 0) {
        logger.info('No matching SAs found in SA to AM mapping', {
          saAssignmentId,
          am: saAssignment.am,
          practices
        });
        return { 
          success: false, 
          assignedSas: [], 
          region: '', 
          message: 'No matching SAs found in mapping database' 
        };
      }
      
      logger.info('Found matching SAs', { 
        saAssignmentId,
        matchingSas: matchingSas.map(sa => ({ name: sa.saName, region: sa.region, practices: sa.practices }))
      });
      
      // Extract unique SAs and determine region
      const uniqueSas = this.extractUniqueSAs(matchingSas);
      const assignedRegion = this.determineRegion(matchingSas);
      
      // Combine existing SAs with new ones
      const existingSas = saAssignment.saAssigned ? saAssignment.saAssigned.split(',').map(s => s.trim()) : [];
      const combinedSas = [...new Set([...existingSas, ...uniqueSas])];
      
      // Update the SA assignment with combined SAs and region
      const updateResult = await this.updateSaAssignment(saAssignmentId, combinedSas, assignedRegion || saAssignment.region, practices, matchingSas, existingSas);
      
      if (updateResult.success) {
        logger.info('SA auto-assignment completed successfully', {
          saAssignmentId,
          assignedSas: uniqueSas,
          region: assignedRegion
        });
        
        return {
          success: true,
          assignedSas: uniqueSas,
          region: assignedRegion || saAssignment.region,
          message: `Auto-assigned ${uniqueSas.length} additional SA(s) for uncovered practices`
        };
      } else {
        logger.error('Failed to update SA assignment with auto-assigned SAs', {
          saAssignmentId,
          error: updateResult.error
        });
        
        return {
          success: false,
          assignedSas: [],
          region: '',
          message: 'Failed to update SA assignment with auto-assigned SAs'
        };
      }
      
    } catch (error) {
      logger.error('Error in SA auto-assignment process', {
        saAssignmentId,
        error: error.message,
        stack: error.stack
      });
      
      return {
        success: false,
        assignedSas: [],
        region: '',
        message: `Auto-assignment failed: ${error.message}`
      };
    }
  }
  
  /**
   * Parses practice string into array of practices
   * @param {string} practiceString - Practice string (could be comma-separated)
   * @returns {Array<string>} Array of practice names
   */
  parsePractices(practiceString) {
    if (!practiceString) return [];
    
    // If it's already an array, return it
    if (Array.isArray(practiceString)) return practiceString;
    
    // Split by comma and clean up
    return practiceString
      .split(',')
      .map(practice => practice.trim())
      .filter(practice => practice.length > 0);
  }
  
  /**
   * Gets practices that don't have SA assignments yet
   * @param {Object} saAssignment - SA assignment object
   * @param {Array<string>} allPractices - All practices for this assignment
   * @returns {Promise<Array<string>>} Array of uncovered practice names
   */
  async getUncoveredPractices(saAssignment, allPractices) {
    if (!saAssignment.saAssigned) {
      return allPractices; // No SAs assigned yet, all practices uncovered
    }
    
    try {
      const assignedSas = saAssignment.saAssigned.split(',').map(s => s.trim());
      const users = await db.getAllUsers();
      const coveredPractices = new Set();
      
      // Check which practices are covered by existing SA assignments
      assignedSas.forEach(saName => {
        const user = users.find(u => u.name === saName);
        if (user && user.practices) {
          user.practices.forEach(practice => {
            if (allPractices.includes(practice)) {
              coveredPractices.add(practice);
            }
          });
        }
      });
      
      return allPractices.filter(practice => !coveredPractices.has(practice));
    } catch (error) {
      logger.error('Error checking uncovered practices', { error: error.message });
      return allPractices; // Return all if error
    }
  }
  
  /**
   * Finds matching SAs from SA to AM mapping database
   * @param {string} amName - Account Manager name
   * @param {Array<string>} practices - Array of practice names
   * @returns {Promise<Array>} Array of matching SA mappings
   */
  async findMatchingSAs(amName, practices) {
    try {
      // Get all SA to AM mappings directly from database
      const allMappings = await this.getAllSaToAmMappings();
      
      logger.info('Retrieved SA to AM mappings', { totalMappings: allMappings.length });
      
      // Extract email from SA assignment AM field or lookup by name
      const extractEmail = (nameWithEmail) => {
        if (!nameWithEmail) return null;
        const match = nameWithEmail.match(/<([^>]+)>/);
        return match ? match[1] : nameWithEmail.toLowerCase().includes('@') ? nameWithEmail : null;
      };
      
      let amEmail = extractEmail(amName);
      
      // If no email found, try to lookup user by name to get email
      if (!amEmail && amName) {
        try {
          const users = await db.getAllUsers();
          const user = users.find(u => u.name === amName);
          if (user && user.email) {
            amEmail = user.email;
          }
        } catch (error) {
          logger.error('Error looking up user email', { error: error.message });
        }
      }
      
      logger.info('Extracted AM email for matching', { amName, amEmail });
      
      // Filter mappings that match the AM and have overlapping practices
      const matchingMappings = allMappings.filter(mapping => {
        // Check if AM matches by email (stored in mapping)
        const amMatches = amEmail && mapping.amEmail && amEmail.toLowerCase() === mapping.amEmail.toLowerCase();
        
        // Check if any practices overlap
        const mappingPractices = mapping.practices || [];
        const practicesOverlap = practices.some(practice => 
          mappingPractices.includes(practice)
        );
        
        const matches = amMatches && practicesOverlap;
        
        logger.info('Checking mapping match', {
          saName: mapping.saName,
          mappingAmEmail: mapping.amEmail,
          extractedAmEmail: amEmail,
          amMatches,
          mappingPractices,
          requestedPractices: practices,
          practicesOverlap,
          finalMatch: matches
        });
        
        return matches;
      });
      
      logger.info('Filtered matching mappings', { 
        matchingCount: matchingMappings.length,
        amName,
        practices
      });
      
      return matchingMappings;
      
    } catch (error) {
      logger.error('Error finding matching SAs', {
        amName,
        practices,
        error: error.message
      });
      return [];
    }
  }
  
  /**
   * Gets all SA to AM mappings from database
   * @returns {Promise<Array>} Array of all SA to AM mappings
   */
  async getAllSaToAmMappings() {
    try {
      const command = new (await import('@aws-sdk/client-dynamodb')).ScanCommand({
        TableName: (await import('./dynamodb.js')).getTableName('SAToAMMappings')
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
        created_at: item.created_at?.S || '',
        updated_at: item.updated_at?.S || ''
      }));
      
      logger.info('Retrieved SA to AM mappings from database', { 
        mappingCount: mappings.length 
      });
      
      return mappings;
      
    } catch (error) {
      logger.error('Error retrieving SA to AM mappings from database', {
        error: error.message
      });
      return [];
    }
  }
  
  /**
   * Extracts unique SA names from matching mappings
   * @param {Array} matchingSas - Array of matching SA mappings
   * @returns {Array<string>} Array of unique SA names
   */
  extractUniqueSAs(matchingSas) {
    const uniqueSaNames = [...new Set(matchingSas.map(mapping => mapping.saName))];
    logger.info('Extracted unique SAs', { uniqueSaNames });
    return uniqueSaNames;
  }
  
  /**
   * Determines the region from matching mappings
   * @param {Array} matchingSas - Array of matching SA mappings
   * @returns {string} The determined region
   */
  determineRegion(matchingSas) {
    if (matchingSas.length === 0) return '';
    
    // Get all unique regions
    const regions = [...new Set(matchingSas.map(mapping => mapping.region))];
    
    // If all mappings have the same region, use that
    if (regions.length === 1) {
      logger.info('Single region determined', { region: regions[0] });
      return regions[0];
    }
    
    // If multiple regions, use the first one (could be enhanced with more logic)
    logger.info('Multiple regions found, using first', { 
      regions, 
      selectedRegion: regions[0] 
    });
    return regions[0];
  }
  
  /**
   * Updates the SA assignment with auto-assigned SAs and region
   * @param {string} saAssignmentId - SA assignment ID
   * @param {Array<string>} assignedSas - Array of SA names to assign
   * @param {string} region - Region to assign
   * @param {Array<string>} practices - Array of practices for this assignment
   * @param {Array} matchingSas - Array of matching SA mappings
   * @param {Array<string>} existingSas - Array of existing SA assignments
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async updateSaAssignment(saAssignmentId, assignedSas, region, practices, matchingSas, existingSas = []) {
    try {
      // Check if all practices have at least one SA assigned using combined SAs
      const users = await db.getAllUsers();
      const practicesWithSas = new Set();
      
      assignedSas.forEach(saName => {
        const user = users.find(u => u.name === saName);
        if (user && user.practices) {
          user.practices.forEach(practice => {
            if (practices.includes(practice)) {
              practicesWithSas.add(practice);
            }
          });
        }
      });
      
      const allPracticesCovered = practices.every(practice => practicesWithSas.has(practice));
      const finalStatus = allPracticesCovered ? 'Assigned' : 'Unassigned';
      
      // Prepare update data
      const updates = {
        saAssigned: assignedSas.join(', '), // Join multiple SAs with comma
        region: region,
        status: finalStatus,
        dateAssigned: allPracticesCovered ? new Date().toISOString().split('T')[0] : '' // Only set date if fully assigned
      };
      
      logger.info('Updating SA assignment', {
        saAssignmentId,
        practices,
        practicesWithSas: Array.from(practicesWithSas),
        allPracticesCovered,
        finalStatus,
        updates
      });
      
      // Update the SA assignment
      const success = await db.updateSaAssignment(saAssignmentId, updates);
      
      if (success) {
        logger.info('SA assignment updated successfully', { saAssignmentId, status: finalStatus });
        return { success: true };
      } else {
        logger.error('Failed to update SA assignment', { saAssignmentId });
        return { success: false, error: 'Database update failed' };
      }
      
    } catch (error) {
      logger.error('Error updating SA assignment', {
        saAssignmentId,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
export const saAutoAssignment = new SaAutoAssignment();