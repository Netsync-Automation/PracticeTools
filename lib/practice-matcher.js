import { db } from './dynamodb.js';
import { logger } from './safe-logger.js';

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Calculate similarity score (0-1, higher is better)
 */
function calculateSimilarity(str1, str2) {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1;
  
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  return (maxLength - distance) / maxLength;
}

/**
 * Match input text to best practice from database
 */
export async function matchPractice(inputText, threshold = 0.6) {
  try {
    // Get all practices from database
    const practices = await getPracticesList();
    
    if (!practices || practices.length === 0) {
      logger.warn('No practices found in database');
      return null;
    }
    
    let bestMatch = null;
    let bestScore = 0;
    
    // Normalize input
    const normalizedInput = inputText.toLowerCase().trim();
    
    // Extract abbreviation from parentheses if present
    const abbreviationMatch = inputText.match(/\(([A-Z]+)\)/);
    const inputAbbreviation = abbreviationMatch ? abbreviationMatch[1].toLowerCase() : null;
    
    for (const practice of practices) {
      const normalizedPractice = practice.toLowerCase().trim();
      
      // Special handling for abbreviation matching
      if (inputAbbreviation) {
        // Check if practice contains the abbreviation as a whole word or part of compound words
        const abbrevRegex = new RegExp(`\\b${inputAbbreviation}\\b|/${inputAbbreviation}\\b|\\b${inputAbbreviation}/`, 'i');
        if (abbrevRegex.test(normalizedPractice)) {
          const score = 0.9; // High score for abbreviation match
          logger.info('Abbreviation match found', {
            input: inputText,
            abbreviation: inputAbbreviation,
            practice: practice,
            score: score
          });
          if (score > bestScore) {
            bestScore = score;
            bestMatch = practice;
          }
          continue;
        }
        
        // Special case: if input contains "enterprise networking" and abbreviation is "EN",
        // strongly prefer "Enterprise Networking" over other practices
        if (inputAbbreviation.toLowerCase() === 'en' && 
            normalizedInput.includes('enterprise') && 
            normalizedInput.includes('networking') &&
            normalizedPractice.includes('enterprise') && 
            normalizedPractice.includes('networking')) {
          const score = 0.95; // Very high score for this specific case
          logger.info('Special Enterprise Networking match', {
            input: inputText,
            practice: practice,
            score: score
          });
          if (score > bestScore) {
            bestScore = score;
            bestMatch = practice;
          }
          continue;
        }
      }
      
      // Direct substring match gets bonus
      if (normalizedPractice.includes(normalizedInput) || normalizedInput.includes(normalizedPractice)) {
        const score = calculateSimilarity(normalizedInput, normalizedPractice) + 0.2;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = practice;
        }
        continue;
      }
      
      // Check for keyword matches - filter out very short words unless they're known abbreviations
      const inputWords = normalizedInput.split(/[\s\/\(\)\-]+/).filter(w => w.length > 2 || (w.length >= 2 && w === w.toUpperCase()));
      const practiceWords = normalizedPractice.split(/[\s\/\(\)\-]+/).filter(w => w.length > 2);
      
      let keywordMatches = 0;
      let exactKeywordMatches = 0;
      
      for (const inputWord of inputWords) {
        for (const practiceWord of practiceWords) {
          const similarity = calculateSimilarity(inputWord, practiceWord);
          if (similarity > 0.8) {
            keywordMatches++;
            if (similarity === 1.0) {
              exactKeywordMatches++;
            }
            break;
          }
        }
      }
      
      // Special boost for multiple exact keyword matches (like "optical" and "wan")
      let score = calculateSimilarity(normalizedInput, normalizedPractice);
      if (keywordMatches > 0) {
        const keywordBonus = (keywordMatches / Math.max(inputWords.length, practiceWords.length)) * 0.4;
        const exactBonus = (exactKeywordMatches / Math.max(inputWords.length, practiceWords.length)) * 0.2;
        score += keywordBonus + exactBonus;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = practice;
      }
    }
    
    logger.info('Practice matching result', {
      input: inputText,
      inputAbbreviation: inputAbbreviation,
      bestMatch: bestMatch,
      score: bestScore,
      threshold: threshold,
      allPractices: practices
    });
    
    return bestScore >= threshold ? bestMatch : null;
    
  } catch (error) {
    logger.error('Error matching practice', { error: error.message, input: inputText });
    return null;
  }
}

/**
 * Get list of practices from database
 */
async function getPracticesList() {
  try {
    // Get practices from settings or users table
    const practices = await db.getSetting('practices');
    if (practices) {
      return JSON.parse(practices);
    }
    
    // Fallback: get unique practices from users
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

/**
 * Test the matcher with example inputs
 */
export async function testPracticeMatcher() {
  const testCases = [
    'av/video (uc)',
    'collaboration',
    'security',
    'data center',
    'cloud',
    'networking'
  ];
  
  console.log('Testing Practice Matcher:');
  for (const testCase of testCases) {
    const match = await matchPractice(testCase);
    console.log(`"${testCase}" -> "${match}"`);
  }
}