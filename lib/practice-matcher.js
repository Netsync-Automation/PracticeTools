import { db } from './dynamodb.js';
import { logger } from './safe-logger.js';

/**
 * Soundex algorithm for phonetic matching (industry standard)
 */
function soundex(str) {
  const s = str.toUpperCase().replace(/[^A-Z]/g, '');
  if (!s) return '0000';
  
  let result = s[0];
  const mapping = { B:1,F:1,P:1,V:1, C:2,G:2,J:2,K:2,Q:2,S:2,X:2,Z:2, D:3,T:3, L:4, M:5,N:5, R:6 };
  
  for (let i = 1; i < s.length && result.length < 4; i++) {
    const code = mapping[s[i]];
    if (code && code !== mapping[s[i-1]]) {
      result += code;
    }
  }
  
  return result.padEnd(4, '0').substring(0, 4);
}

/**
 * Damerau-Levenshtein distance (handles transpositions)
 */
function damerauLevenshteinDistance(s1, s2) {
  const len1 = s1.length, len2 = s2.length;
  const H = Array(len1 + 2).fill().map(() => Array(len2 + 2).fill(0));
  const da = {};
  
  const maxdist = len1 + len2;
  H[0][0] = maxdist;
  
  for (let i = 0; i <= len1; i++) { H[i+1][0] = maxdist; H[i+1][1] = i; }
  for (let j = 0; j <= len2; j++) { H[0][j+1] = maxdist; H[1][j+1] = j; }
  
  for (let i = 1; i <= len1; i++) {
    let db = 0;
    for (let j = 1; j <= len2; j++) {
      const i1 = da[s2[j-1]] || 0;
      const j1 = db;
      let cost = 1;
      if (s1[i-1] === s2[j-1]) { cost = 0; db = j; }
      
      H[i+1][j+1] = Math.min(
        H[i][j] + cost,
        H[i+1][j] + 1,
        H[i][j+1] + 1,
        H[i1][j1] + (i-i1-1) + 1 + (j-j1-1)
      );
    }
    da[s1[i-1]] = i;
  }
  
  return H[len1+1][len2+1];
}

/**
 * Normalized Damerau-Levenshtein similarity
 */
function editSimilarity(s1, s2) {
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  return 1 - (damerauLevenshteinDistance(s1, s2) / maxLen);
}

/**
 * Advanced tokenization with abbreviation expansion
 */
function expandedTokenize(text) {
  const expansions = {
    'av': ['audio', 'visual'],
    'uc': ['unified', 'communications'],
    'cx': ['customer', 'experience'],
    'iot': ['internet', 'things'],
    'wan': ['wide', 'area', 'network'],
    'dc': ['data', 'center']
  };
  
  let expanded = text.toLowerCase();
  for (const [abbr, words] of Object.entries(expansions)) {
    expanded = expanded.replace(new RegExp(`\\b${abbr}\\b`, 'g'), words.join(' '));
  }
  
  return expanded.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 1);
}

/**
 * Semantic similarity using expanded tokens and phonetic matching
 */
function semanticSimilarity(s1, s2) {
  const tokens1 = expandedTokenize(s1);
  const tokens2 = expandedTokenize(s2);
  
  if (tokens1.length === 0 || tokens2.length === 0) return 0;
  
  let totalScore = 0;
  let matches = 0;
  
  for (const token1 of tokens1) {
    let bestScore = 0;
    for (const token2 of tokens2) {
      // Exact match
      if (token1 === token2) {
        bestScore = 1;
        break;
      }
      // Phonetic match
      if (soundex(token1) === soundex(token2)) {
        bestScore = Math.max(bestScore, 0.8);
      }
      // Edit distance match
      const editScore = editSimilarity(token1, token2);
      if (editScore > 0.6) {
        bestScore = Math.max(bestScore, editScore * 0.7);
      }
    }
    if (bestScore > 0.5) {
      totalScore += bestScore;
      matches++;
    }
  }
  
  return matches > 0 ? totalScore / Math.max(tokens1.length, tokens2.length) : 0;
}

/**
 * Match input text to best practice using industry-standard algorithms
 */
export async function matchPractice(inputText, threshold = 0.4) {
  try {
    const practices = await getPracticesList();
    
    if (!practices || practices.length === 0) {
      logger.warn('No practices found in database');
      return null;
    }
    
    let bestMatch = null;
    let bestScore = 0;
    
    const cleanInput = inputText.replace(/\([^)]*\)/g, '').trim();
    
    for (const practice of practices) {
      // Calculate advanced similarity metrics
      const editSim = editSimilarity(cleanInput.toLowerCase(), practice.toLowerCase());
      const semanticSim = semanticSimilarity(cleanInput, practice);
      
      // Optimized weighting for practice matching with abbreviations
      const finalScore = (editSim * 0.4) + (semanticSim * 0.6);
      
      logger.info('Practice matching calculation', {
        input: inputText,
        practice: practice,
        editSimilarity: editSim.toFixed(3),
        semanticSimilarity: semanticSim.toFixed(3),
        finalScore: finalScore.toFixed(3)
      });
      
      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestMatch = practice;
      }
    }
    
    logger.info('Practice matching result', {
      input: inputText,
      bestMatch: bestMatch,
      score: bestScore.toFixed(3),
      threshold: threshold,
      matched: bestScore >= threshold
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