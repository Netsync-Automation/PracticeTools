#!/usr/bin/env node

/**
 * Manual Release Creator
 * Use this to manually trigger the automated versioning system
 */

import { FeatureVersioning } from './lib/auto-versioning.js';

console.log('🚀 Manual Release Trigger');
console.log('This will analyze the current feature inventory and create a release if changes are detected.');

try {
  const release = await FeatureVersioning.processDeployment();
  
  if (release) {
    console.log(`✅ Release ${release.version} created successfully!`);
    console.log(`📅 Date: ${release.date}`);
    console.log(`📋 Type: ${release.type}`);
    console.log(`📊 Changes: ${release.changes.added} added, ${release.changes.modified} modified, ${release.changes.removed} removed`);
  } else {
    console.log('📋 No changes detected - no release created');
  }
} catch (error) {
  console.error('❌ Failed to process release:', error.message);
  process.exit(1);
}