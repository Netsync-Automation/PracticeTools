import Fuse from 'fuse.js';
import { db } from './dynamodb.js';
import { logger } from './safe-logger.js';

/**
 * Advanced practice matcher using Fuse.js
 */
export async function matchPracticeAdvanced(inputText, threshold = 0.4) {
  try {
    const practices = await getPracticesList();
    
    if (!practices || practices.length === 0) {
      logger.warn('No practices found in database');
      return null;
    }
    
    // Configure Fuse.js options
    const options = {
      includeScore: true,
      threshold: threshold, // Lower = more strict
      ignoreLocation: true,
      keys: ['name']
    };
    
    // Prepare data for Fuse
    const practiceObjects = practices.map(practice => ({ name: practice }));
    const fuse = new Fuse(practiceObjects, options);
    
    // Search
    const results = fuse.search(inputText);
    
    if (results.length > 0) {
      const bestMatch = results[0];
      logger.info('Advanced practice matching result', {
        input: inputText,
        bestMatch: bestMatch.item.name,
        score: bestMatch.score,
        threshold: threshold
      });
      
      return bestMatch.item.name;
    }
    
    return null;
    
  } catch (error) {
    logger.error('Error in advanced practice matching', { error: error.message, input: inputText });
    return null;
  }
}

/**
 * Get list of practices from database
 */
async function getPracticesList() {
  try {
    const practices = await db.getSetting('practices');
    if (practices) {
      return JSON.parse(practices);
    }
    
    const users = await db.getAllUsers();
    const practiceSet = new Set();
    
    users.forEach(user => {
      if (user.practices && Array.isArray(user.practices)) {
        user.practices.forEach(practice => {
          if (practice && practice.trim()) {
            practiceSet.add(practice.trim());
          }
        });
      }
    });
    
    return Array.from(practiceSet);
    
  } catch (error) {
    logger.error('Error getting practices list', { error: error.message });
    return [];
  }
}