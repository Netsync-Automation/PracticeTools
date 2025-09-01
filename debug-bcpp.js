#!/usr/bin/env node

import { execSync } from 'child_process';
import { db } from './lib/dynamodb.js';

console.log('🔍 DEBUGGING BCPP FEATURE DETECTION\n');

// Check git status
try {
  const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
  console.log('📁 Git Status:');
  console.log(gitStatus || 'No changes detected by git');
  console.log('');
} catch (error) {
  console.log('❌ Git error:', error.message);
}

// Check modified files
try {
  const modifiedFiles = execSync('git diff --name-only HEAD', { encoding: 'utf8' });
  console.log('📝 Modified Files (git diff):');
  console.log(modifiedFiles || 'No modified files');
  console.log('');
} catch (error) {
  console.log('❌ Git diff error:', error.message);
}

// Check unstaged changes
try {
  const unstagedFiles = execSync('git diff --name-only', { encoding: 'utf8' });
  console.log('📝 Unstaged Files:');
  console.log(unstagedFiles || 'No unstaged files');
  console.log('');
} catch (error) {
  console.log('❌ Unstaged files error:', error.message);
}

// Check staged changes
try {
  const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' });
  console.log('📝 Staged Files:');
  console.log(stagedFiles || 'No staged files');
  console.log('');
} catch (error) {
  console.log('❌ Staged files error:', error.message);
}

// Check current features in database
try {
  const features = await db.getAllFeatures();
  console.log(`📊 Current Features in Database: ${features.length}`);
  
  // Show recent features
  const recentFeatures = features
    .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
    .slice(0, 5);
    
  console.log('\n🕒 Most Recent Features:');
  recentFeatures.forEach(f => {
    console.log(`   • ${f.name} (${f.category}) - ${f.dateAdded}`);
  });
  
} catch (error) {
  console.log('❌ Database error:', error.message);
}

console.log('\n🔍 ISSUE ANALYSIS:');
console.log('The BCPP system only detects changes that are:');
console.log('1. Modified but NOT committed to git');
console.log('2. Currently in git working directory');
console.log('3. If all changes are committed, BCPP sees 0 changes');
console.log('\n💡 SOLUTION: BCPP should track committed changes since last feature update');