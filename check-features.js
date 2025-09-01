#!/usr/bin/env node

/**
 * Feature Inventory Checker
 * Run this before making ANY changes to the codebase
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve, normalize } from 'path';

// Safe path validation to prevent path traversal
function validatePath(inputPath, basePath) {
  const normalizedPath = normalize(inputPath);
  const resolvedPath = resolve(basePath, normalizedPath);
  const resolvedBase = resolve(basePath);
  
  // Ensure the resolved path is within the base directory
  if (!resolvedPath.startsWith(resolvedBase)) {
    throw new Error('Path traversal attempt detected');
  }
  
  return resolvedPath;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 CHECKING FEATURE INVENTORY...\n');

try {
  const inventoryPath = validatePath('FEATURE_INVENTORY.md', __dirname);
  const inventory = readFileSync(inventoryPath, 'utf8');
  
  console.log('✅ Feature inventory loaded successfully');
  console.log('📋 Total features documented:', (inventory.match(/^###/gm) || []).length);
  console.log('📅 Last updated:', inventory.match(/\*\*Last Updated:\*\* (.+)/)?.[1] || 'Unknown');
  
  console.log('\n⚠️  REMINDER: Before making changes:');
  console.log('   1. Read the complete feature inventory');
  console.log('   2. Identify all affected systems');
  console.log('   3. Test all related features after changes');
  console.log('   4. Update the inventory with new features');
  console.log('   5. Automated versioning will detect changes on deployment');
  
  console.log('\n📖 Feature inventory location: FEATURE_INVENTORY.md');
  console.log('🤖 Automated versioning: Enabled - changes tracked on deployment');
  console.log('📝 Manual release trigger: node create-release.js');
  
} catch (error) {
  console.error('❌ ERROR: Could not load feature inventory!');
  console.error('   Make sure FEATURE_INVENTORY.md exists in the project root');
  console.error('   This file is CRITICAL for preventing breaking changes');
  process.exit(1);
}