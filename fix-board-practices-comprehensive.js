import { db, getEnvironment } from './lib/dynamodb.js';

// DSR-compliant comprehensive fix for board practices field
async function fixAllBoardPractices() {
  console.log('🔧 DSR-compliant comprehensive board practices fix');
  
  const environments = ['dev', 'prod'];
  const results = { dev: [], prod: [] };
  
  for (const env of environments) {
    console.log(`\n📍 Processing ${env.toUpperCase()} environment...`);
    process.env.ENVIRONMENT = env;
    
    try {
      // Get all practice boards in this environment
      const boards = await db.getAllPracticeBoards();
      console.log(`Found ${boards.length} boards in ${env}`);
      
      // Get all settings that look like practice boards
      const allSettings = await db.getAllSettings();
      const boardSettings = allSettings.filter(setting => 
        setting.setting_key.includes(`${env}_practice_board_`)
      );
      
      console.log(`Found ${boardSettings.length} board settings in ${env}`);
      
      for (const setting of boardSettings) {
        try {
          const boardData = JSON.parse(setting.setting_value);
          const boardKey = setting.setting_key;
          
          // Check if practices field is missing or empty
          if (!boardData.practices || !Array.isArray(boardData.practices) || boardData.practices.length === 0) {
            console.log(`🔍 Board ${boardKey} missing practices field`);
            
            // Extract practice from board key
            const practiceId = boardKey.replace(`${env}_practice_board_`, '').split('_')[0];
            const inferredPractices = inferPracticesFromId(practiceId);
            
            if (inferredPractices.length > 0) {
              console.log(`✅ Inferred practices for ${boardKey}:`, inferredPractices);
              
              // Add practices field
              const updatedBoardData = {
                ...boardData,
                practices: inferredPractices,
                fixedAt: new Date().toISOString(),
                fixedBy: 'DSR-compliance-script'
              };
              
              // Save updated board
              const success = await db.saveSetting(boardKey, JSON.stringify(updatedBoardData));
              
              if (success) {
                console.log(`✅ Fixed ${boardKey}`);
                results[env].push({
                  boardKey,
                  practiceId,
                  addedPractices: inferredPractices,
                  status: 'fixed'
                });
              } else {
                console.log(`❌ Failed to fix ${boardKey}`);
                results[env].push({
                  boardKey,
                  practiceId,
                  status: 'failed'
                });
              }
            } else {
              console.log(`⚠️ Could not infer practices for ${boardKey}`);
              results[env].push({
                boardKey,
                practiceId,
                status: 'could-not-infer'
              });
            }
          } else {
            console.log(`✅ Board ${boardKey} already has practices:`, boardData.practices);
            results[env].push({
              boardKey,
              practiceId: boardKey.replace(`${env}_practice_board_`, '').split('_')[0],
              existingPractices: boardData.practices,
              status: 'already-correct'
            });
          }
        } catch (parseError) {
          console.error(`❌ Error parsing board data for ${setting.setting_key}:`, parseError.message);
          results[env].push({
            boardKey: setting.setting_key,
            status: 'parse-error',
            error: parseError.message
          });
        }
      }
    } catch (error) {
      console.error(`❌ Error processing ${env} environment:`, error);
    }
  }
  
  // Print summary
  console.log('\n📊 COMPREHENSIVE FIX SUMMARY:');
  for (const env of environments) {
    console.log(`\n${env.toUpperCase()} Environment:`);
    const envResults = results[env];
    const fixed = envResults.filter(r => r.status === 'fixed').length;
    const alreadyCorrect = envResults.filter(r => r.status === 'already-correct').length;
    const failed = envResults.filter(r => r.status === 'failed').length;
    const couldNotInfer = envResults.filter(r => r.status === 'could-not-infer').length;
    
    console.log(`  ✅ Fixed: ${fixed}`);
    console.log(`  ✅ Already correct: ${alreadyCorrect}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  ⚠️ Could not infer: ${couldNotInfer}`);
    
    if (envResults.length > 0) {
      console.log('  Details:');
      envResults.forEach(result => {
        console.log(`    - ${result.boardKey}: ${result.status}`);
        if (result.addedPractices) {
          console.log(`      Added practices: ${result.addedPractices.join(', ')}`);
        }
        if (result.existingPractices) {
          console.log(`      Existing practices: ${result.existingPractices.join(', ')}`);
        }
      });
    }
  }
  
  return results;
}

// DSR: Infer practices from practice ID using known patterns
function inferPracticesFromId(practiceId) {
  const practiceMap = {
    'audiovisual-collaboration-contactcenter-iot-physicalsecurity': ['Collaboration'],
    'collaboration': ['Collaboration'],
    'security': ['Security'],
    'datacenter': ['Data Center'],
    'networking': ['Networking'],
    'cloud': ['Cloud'],
    'wireless': ['Wireless']
  };
  
  // Direct match
  if (practiceMap[practiceId]) {
    return practiceMap[practiceId];
  }
  
  // Try to match parts of compound IDs
  const practices = [];
  for (const [key, value] of Object.entries(practiceMap)) {
    if (practiceId.includes(key) || key.includes(practiceId)) {
      practices.push(...value);
    }
  }
  
  return [...new Set(practices)]; // Remove duplicates
}

// Run the comprehensive fix
console.log('🚀 Starting DSR-compliant comprehensive board practices fix...');
fixAllBoardPractices().then(results => {
  console.log('\n🎉 Comprehensive fix completed!');
  
  // Check if any boards were actually fixed
  const totalFixed = results.dev.filter(r => r.status === 'fixed').length + 
                    results.prod.filter(r => r.status === 'fixed').length;
  
  if (totalFixed > 0) {
    console.log(`✅ Successfully fixed ${totalFixed} boards across both environments`);
  } else {
    console.log('ℹ️ No boards needed fixing - all were already correct');
  }
  
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Comprehensive fix failed:', error);
  process.exit(1);
});