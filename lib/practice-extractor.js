import { logger } from './safe-logger.js';
import { matchPractice } from './practice-matcher.js';

/**
 * Extract practices from Technologies section in SA assignment emails
 * @param {string} emailContent - Full email content
 * @returns {Array} Array of extracted practice names
 */
export function extractPracticesFromTechnologies(emailContent) {
  try {
    // Find the Technologies section
    const techMatch = emailContent.match(/Technologies:[\s\S]*?(?=Submited By:|$)/i);
    if (!techMatch) {
      logger.info('No Technologies section found in email');
      return [];
    }
    
    const techSection = techMatch[0];
    const lines = techSection.split(/\n|&#xd;/i);
    
    const practices = [];
    
    // Look for lines with format: "Technology Name SA Name SA requested"
    for (const line of lines) {
      const cleanLine = line.replace(/&#x[da];?/gi, '').trim();
      
      // Skip header lines and empty lines
      if (cleanLine.toLowerCase().includes('technology name') || 
          cleanLine.toLowerCase().includes('technologies:') ||
          !cleanLine) {
        continue;
      }
      
      // Parse line format: "AV/Video (UC)   Bryan Brown     Yes" or "Collaboration (UC)              Yes"
      const parts = cleanLine.split(/\s{2,}/);
      if (parts.length >= 2) {
        const technology = parts[0].trim();
        const requested = parts[parts.length - 1].trim().toLowerCase(); // Last part is always the requested status
        
        // Only include technologies where SA is requested
        if (technology && requested === 'yes') {
          practices.push(technology);
        }
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
 * @returns {Promise<Object>} Object with practices array and saAssignments mapping
 */
export async function extractAndMatchPractice(emailContent) {
  try {
    const extractedPractices = extractPracticesFromTechnologies(emailContent);
    
    if (extractedPractices.length === 0) {
      return { practices: 'Pending', saAssignments: {} };
    }
    
    const matchedPractices = [];
    const saAssignments = {};
    
    // Try to match each extracted practice and extract SA assignments
    for (const practice of extractedPractices) {
      const matchedPractice = await matchPractice(practice, 0.25);
      
      if (matchedPractice && !matchedPractices.includes(matchedPractice)) {
        matchedPractices.push(matchedPractice);
        
        // Extract SA names from the Technologies section for this practice
        const saNames = extractSANamesForPractice(emailContent, practice);
        if (saNames.length > 0) {
          saAssignments[matchedPractice] = saNames;
        }
        
        logger.info('Successfully matched practice with SAs', {
          extracted: practice,
          matched: matchedPractice,
          saNames: saNames
        });
      }
    }
    
    if (matchedPractices.length > 0) {
      const result = matchedPractices.join(', ');
      logger.info('All matched practices with SA assignments', {
        extractedPractices,
        matchedPractices,
        result,
        saAssignments
      });
      return { practices: result, saAssignments };
    }
    
    logger.warn('No practice matches found, using Pending', {
      extractedPractices
    });
    return { practices: 'Pending', saAssignments: {} };
    
  } catch (error) {
    logger.error('Error in extractAndMatchPractice', { error: error.message });
    return { practices: 'Pending', saAssignments: {} };
  }
}

/**
 * Extract SA names for a specific practice from Technologies section
 * @param {string} emailContent - Full email content
 * @param {string} practiceText - The practice text to find SAs for
 * @returns {Array} Array of SA names
 */
function extractSANamesForPractice(emailContent, practiceText) {
  try {
    // Find the Technologies section
    const techMatch = emailContent.match(/Technologies:[\s\S]*?(?=Submited By:|$)/i);
    if (!techMatch) {
      return [];
    }
    
    const techSection = techMatch[0];
    const lines = techSection.split(/\n|&#xd;/i);
    
    const saNames = [];
    
    // Look for lines with format: "Technology Name SA Name SA requested"
    for (const line of lines) {
      const cleanLine = line.replace(/&#x[da];?/gi, '').trim();
      
      // Skip header lines
      if (cleanLine.toLowerCase().includes('technology name') || 
          cleanLine.toLowerCase().includes('technologies:') ||
          !cleanLine) {
        continue;
      }
      
      // Parse line format: "AV/Video (UC)   Bryan Brown     Yes" or "Collaboration (UC)              Yes"
      const parts = cleanLine.split(/\s{2,}/);
      if (parts.length >= 2) {
        const technology = parts[0].trim();
        const saName = parts.length >= 3 ? parts[1].trim() : ''; // SA name might be empty
        const requested = parts[parts.length - 1].trim().toLowerCase(); // Last part is always the requested status
        
        // Check if this technology matches the practice we're looking for
        if (technology.toLowerCase().includes(practiceText.toLowerCase()) ||
            practiceText.toLowerCase().includes(technology.toLowerCase())) {
          if (saName && saName.length > 2 && requested === 'yes') {
            saNames.push(saName);
          }
        }
      }
    }
    
    logger.info('Extracted SA names for practice', {
      practice: practiceText,
      saNames: saNames
    });
    
    return saNames;
    
  } catch (error) {
    logger.error('Error extracting SA names for practice', {
      error: error.message,
      practice: practiceText
    });
    return [];
  }
}