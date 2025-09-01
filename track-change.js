#!/usr/bin/env node

import { ChangeTracker } from './change-tracker.js';

const args = process.argv.slice(2);

if (args.length < 2) {
  console.log(`
🎯 CHANGE TRACKER - Record your changes for automated commits

Usage: node track-change.js <type> "<description>" [details]

Types:
  feat     - New feature (minor version bump)
  fix      - Bug fix (patch version bump)  
  breaking - Breaking change (major version bump)
  other    - Documentation, refactoring, etc (no version bump)

Examples:
  node track-change.js feat "add admin dashboard filter system"
  node track-change.js fix "resolve attachment download issue"
  node track-change.js breaking "redesign authentication system" --reason "API endpoints changed"
  node track-change.js other "update documentation"

Current tracked changes:
`);
  
  const changes = ChangeTracker.loadChanges();
  const total = changes.features.length + changes.fixes.length + changes.breaking.length + changes.other.length;
  
  if (total === 0) {
    console.log('  No changes tracked yet.');
  } else {
    if (changes.breaking.length > 0) {
      console.log(`  🚨 Breaking: ${changes.breaking.length} changes`);
    }
    if (changes.features.length > 0) {
      console.log(`  ✨ Features: ${changes.features.length} changes`);
    }
    if (changes.fixes.length > 0) {
      console.log(`  🐛 Fixes: ${changes.fixes.length} changes`);
    }
    if (changes.other.length > 0) {
      console.log(`  📝 Other: ${changes.other.length} changes`);
    }
  }
  
  process.exit(1);
}

const [type, description] = args;
const details = {};

// Parse additional details
if (args.includes('--reason')) {
  const reasonIndex = args.indexOf('--reason');
  details.breakingReason = args[reasonIndex + 1];
}

// Map type aliases
const typeMap = {
  'feat': 'features',
  'feature': 'features',
  'fix': 'fixes',
  'bug': 'fixes',
  'breaking': 'breaking',
  'break': 'breaking',
  'other': 'other',
  'chore': 'other',
  'docs': 'other',
  'refactor': 'other'
};

const mappedType = typeMap[type.toLowerCase()];

if (!mappedType) {
  console.error(`❌ Invalid type: ${type}`);
  console.error('Valid types: feat, fix, breaking, other');
  process.exit(1);
}

ChangeTracker.addChange(mappedType, description, details);

// Show summary
const changes = ChangeTracker.loadChanges();
const total = changes.features.length + changes.fixes.length + changes.breaking.length + changes.other.length;

console.log(`\n📊 Total tracked changes: ${total}`);
console.log('💡 Run "node commit-and-push.js" when ready to commit and deploy');