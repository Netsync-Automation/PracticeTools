#!/usr/bin/env node

import { AutoTracker } from './auto-tracker.js';
import { ChangeTracker } from './change-tracker.js';

// Smart commit script that shows what would be committed
async function main() {
  console.log('🔍 SMART COMMIT ANALYZER\n');

  // Auto-detect changes
  console.log('📊 Analyzing current changes...');
  const autoDetected = AutoTracker.autoTrackChanges();
  
  if (autoDetected.length === 0) {
    console.log('ℹ️  No changes detected.');
    process.exit(0);
  }

  console.log(`\n✅ Auto-detected ${autoDetected.length} changes:\n`);
  
  autoDetected.forEach((change, index) => {
    const versionImpact = {
      'features': 'MINOR',
      'fixes': 'PATCH', 
      'breaking': 'MAJOR',
      'other': 'NONE'
    }[change.type];
    
    console.log(`${index + 1}. [${versionImpact}] ${change.type}: ${change.description}`);
    console.log(`   File: ${change.file}`);
  });

  // Show what commits would be generated
  const changes = ChangeTracker.loadChanges();
  const hasBreaking = changes.breaking.length > 0;
  const hasFeatures = changes.features.length > 0;
  const hasFixes = changes.fixes.length > 0;
  
  console.log('\n📝 Planned commits:');
  
  if (hasBreaking) {
    console.log('   feat!: [MAJOR VERSION] Breaking changes detected');
  }
  if (hasFeatures) {
    console.log('   feat: [MINOR VERSION] New features added');
  }
  if (hasFixes) {
    console.log('   fix: [PATCH VERSION] Bug fixes applied');
  }
  
  console.log('\n💡 Run "npm run commit-push" to execute these commits and deploy');
}

main().catch(console.error);