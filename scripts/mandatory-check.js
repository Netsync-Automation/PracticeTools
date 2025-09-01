#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

class BreakingChangeControlProtocol {
  static async enforceBCPP() {
    console.log('🛡️  BREAKING CHANGE CONTROL PROTOCOL (BCPP) - Practice Tools\n');
    
    try {
      // Check if there are any staged changes
      const stagedChanges = execSync('git diff --cached --name-only', { encoding: 'utf8' }).trim();
      
      if (!stagedChanges) {
        console.log('ℹ️  No staged changes detected. BCPP check passed.');
        return true;
      }
      
      console.log('📁 Staged files detected:');
      stagedChanges.split('\n').forEach(file => {
        console.log(`   - ${file}`);
      });
      
      // Check for potentially breaking changes
      const breakingPatterns = [
        /package\.json$/,
        /\.env/,
        /config/,
        /lib\/database\.js$/,
        /lib\/auth\.js$/,
        /app\/api\//
      ];
      
      const potentialBreaking = stagedChanges.split('\n').filter(file => 
        breakingPatterns.some(pattern => pattern.test(file))
      );
      
      if (potentialBreaking.length > 0) {
        console.log('\n⚠️  Potentially breaking changes detected:');
        potentialBreaking.forEach(file => {
          console.log(`   🚨 ${file}`);
        });
        
        console.log('\n📋 BCPP Recommendations:');
        console.log('   1. Review changes carefully for backward compatibility');
        console.log('   2. Update version appropriately (major for breaking changes)');
        console.log('   3. Document breaking changes in release notes');
        console.log('   4. Consider migration guides for users');
        
        return true; // Allow but warn
      }
      
      console.log('\n✅ BCPP check passed - no breaking changes detected');
      return true;
      
    } catch (error) {
      console.error('❌ BCPP check failed:', error.message);
      return false;
    }
  }
  
  static async validateFeatureIntegrity() {
    console.log('🔍 Validating feature integrity...');
    
    const criticalFiles = [
      'lib/database.js',
      'lib/auth.js',
      'lib/environment.js',
      'app/api/auth/login/route.js',
      'app/api/version/route.js'
    ];
    
    const missingFiles = [];
    
    for (const file of criticalFiles) {
      try {
        readFileSync(file);
      } catch (error) {
        missingFiles.push(file);
      }
    }
    
    if (missingFiles.length > 0) {
      console.log('❌ Critical files missing:');
      missingFiles.forEach(file => {
        console.log(`   - ${file}`);
      });
      return false;
    }
    
    console.log('✅ Feature integrity validated');
    return true;
  }
}

async function main() {
  const bcppPassed = await BreakingChangeControlProtocol.enforceBCPP();
  const integrityPassed = await BreakingChangeControlProtocol.validateFeatureIntegrity();
  
  if (!bcppPassed || !integrityPassed) {
    console.log('\n❌ BCPP validation failed. Please address issues before committing.');
    process.exit(1);
  }
  
  console.log('\n✅ All BCPP checks passed. Safe to proceed with commit.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { BreakingChangeControlProtocol };