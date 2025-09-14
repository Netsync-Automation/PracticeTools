import { logger } from './safe-logger.js';
import { matchPractice } from './practice-matcher.js';

/**
 * Extract practices from Technologies section in SA assignment emails
 * @param {string} emailContent - Full email content
 * @returns {Array} Array of extracted practice names
 */
export function extractPracticesFromTechnologies(emailContent) {
  try {
    const content = emailContent.toLowerCase();
    const technologyNameIndex = content.indexOf('technology name');
    const submitedByIndex = content.indexOf('submited by:');
    
    if (technologyNameIndex === -1) {
      logger.info('No Technology Name section found in email');
      return [];
    }
    
    if (submitedByIndex === -1) {
      logger.info('No Submited By section found in email');
      return [];
    }

    // Extract content between "Technology Name" and "Submited By:"
    const sectionContent = emailContent.substring(technologyNameIndex, submitedByIndex);
    const lines = sectionContent.split(/&#xd;|\n/i);
    
    const practices = [];
    let skipNext = false;
    
    for (let i = 0; i < lines.length; i++) {
      if (skipNext) {
        skipNext = false;
        continue;
      }
      
      const cleanLine = lines[i].trim()
        .replace(/&#xd;?/gi, '')
        .replace(/&#xa;?/gi, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
      
      // Skip empty lines, headers, and common non-practice content
      if (!cleanLine || 
          cleanLine.toLowerCase().includes('technology name') ||
          cleanLine.toLowerCase().includes('sa name') ||
          cleanLine.toLowerCase().includes('sa requested') ||
          cleanLine.toLowerCase() === 'yes' ||
          cleanLine.toLowerCase() === 'no' ||
          cleanLine.match(/^[\s\-:]*$/)) {
        continue;
      }
      
      // Check if this looks like a practice name (contains parentheses with abbreviation)
      if (cleanLine.match(/\([A-Z]+\)/)) {
        practices.push(cleanLine);
        // Skip the next two lines (person name and Yes/No)
        i += 2;
      }
    }
    
    logger.info('Extracted practices from Technology section', { 
      practicesFound: practices.length,
      practices: practices 
    });
    
    return practices;
    
  } catch (error) {
    logger.error('Error extracting practices from Technology section', { 
      error: error.message 
    });
    return [];
  }
}

/**
 * Extract and match practices for SA assignments
 * @param {string} emailContent - Full email content
 * @returns {Promise<string>} Matched practices as comma-separated string or 'Pending'
 */
export async function extractAndMatchPractice(emailContent) {
  try {
    const extractedPractices = extractPracticesFromTechnologies(emailContent);
    
    if (extractedPractices.length === 0) {
      return 'Pending';
    }
    
    const matchedPractices = [];
    
    // Try to match each extracted practice
    for (const practice of extractedPractices) {
      const matchedPractice = await matchPractice(practice, 0.2);
      
      if (matchedPractice && !matchedPractices.includes(matchedPractice)) {
        matchedPractices.push(matchedPractice);
        logger.info('Successfully matched practice', {
          extracted: practice,
          matched: matchedPractice
        });
      }
    }
    
    if (matchedPractices.length > 0) {
      const result = matchedPractices.join(', ');
      logger.info('All matched practices', {
        extractedPractices,
        matchedPractices,
        result
      });
      return result;
    }
    
    logger.warn('No practice matches found, using Pending', {
      extractedPractices
    });
    return 'Pending';
    
  } catch (error) {
    logger.error('Error in extractAndMatchPractice', { error: error.message });
    return 'Pending';
  }
}