// Import db once at the top level
const { db } = await import('./dynamodb.js');

/**
 * Validates WebEx bot configuration for practices and returns detailed warnings
 * @param {string|Array} practices - Single practice string or array of practices
 * @param {string} action - Action being performed (created, updated, closed, deleted)
 * @returns {Object} - { hasValidBot: boolean, warnings: Array, validPractices: Array, invalidPractices: Array }
 */
export async function validateWebexBotConfiguration(practices, action = 'created') {
  const practiceArray = Array.isArray(practices) ? practices : [practices];
  const validPractices = [];
  const invalidPractices = [];
  const warnings = [];
  
  console.log(`\n🔍 WEBEX BOT VALIDATION - Action: ${action.toUpperCase()}`);
  console.log(`Practices to validate: ${practiceArray.join(', ')}`);
  
  for (const practice of practiceArray) {
    try {
      const practiceBot = await db.getPracticeWebexBot(practice);
      
      if (practiceBot && practiceBot.ssmPrefix) {
        console.log(`✅ WebEx bot found for practice: ${practice} (SSM: ${practiceBot.ssmPrefix})`);
        validPractices.push(practice);
      } else {
        console.log(`❌ No WebEx bot configured for practice: ${practice}`);
        invalidPractices.push(practice);
        warnings.push(`No WebEx bot configured for practice: ${practice}`);
      }
    } catch (error) {
      console.error(`❌ Error checking WebEx bot for practice ${practice}:`, error.message);
      invalidPractices.push(practice);
      warnings.push(`Error checking WebEx bot for practice: ${practice} - ${error.message}`);
    }
  }
  
  const hasValidBot = validPractices.length > 0;
  
  // Generate specific warning messages based on action
  if (invalidPractices.length > 0) {
    const actionText = {
      'created': 'creation',
      'updated': 'update', 
      'closed': 'closure',
      'deleted': 'deletion'
    }[action] || action;
    
    const practiceList = invalidPractices.length === 1 
      ? `practice "${invalidPractices[0]}"` 
      : `practices: ${invalidPractices.map(p => `"${p}"`).join(', ')}`;
      
    warnings.push(`Issue ${actionText} notification will NOT be sent to ${practiceList} - WebEx bot not configured`);
    
    console.log(`⚠️  WARNING: ${invalidPractices.length} practice(s) missing WebEx bot configuration:`);
    invalidPractices.forEach(practice => {
      console.log(`   - ${practice}: No bot configured`);
    });
  }
  
  if (validPractices.length > 0) {
    console.log(`✅ ${validPractices.length} practice(s) have valid WebEx bot configuration:`);
    validPractices.forEach(practice => {
      console.log(`   - ${practice}: Bot configured`);
    });
  }
  
  console.log(`🔍 WEBEX BOT VALIDATION COMPLETE - Valid: ${validPractices.length}, Invalid: ${invalidPractices.length}\n`);
  
  return {
    hasValidBot,
    warnings,
    validPractices,
    invalidPractices,
    totalPractices: practiceArray.length
  };
}

/**
 * Logs comprehensive WebEx notification status for an issue
 * @param {Object} issue - Issue object with practice information
 * @param {string} action - Action being performed
 * @param {Object} validation - Validation result from validateWebexBotConfiguration
 */
export function logWebexNotificationStatus(issue, action, validation) {
  console.log(`\n📊 WEBEX NOTIFICATION STATUS REPORT`);
  console.log(`Issue #${issue.issue_number}: ${issue.title}`);
  console.log(`Action: ${action.toUpperCase()}`);
  console.log(`Issue Practice: ${issue.practice}`);
  
  if (validation.hasValidBot) {
    console.log(`✅ WebEx notifications ENABLED for: ${validation.validPractices.join(', ')}`);
  }
  
  if (validation.invalidPractices.length > 0) {
    console.log(`❌ WebEx notifications DISABLED for: ${validation.invalidPractices.join(', ')}`);
    console.log(`⚠️  ADMIN ACTION REQUIRED: Configure WebEx bots for missing practices`);
  }
  
  if (validation.warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS:`);
    validation.warnings.forEach((warning, index) => {
      console.log(`   ${index + 1}. ${warning}`);
    });
  }
  
  console.log(`📊 WEBEX NOTIFICATION STATUS REPORT COMPLETE\n`);
}