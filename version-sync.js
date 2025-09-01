#!/usr/bin/env node

import { config } from 'dotenv';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

config({ path: '.env.local' });

/**
 * Comprehensive Version Synchronization Script
 * Ensures all systems (Database, UI, GitHub, Package.json) are in sync
 * and ready for the next commit-push operation
 */
class VersionSync {
  
  static async checkAllSystems() {
    console.log('🔍 COMPREHENSIVE VERSION SYNC CHECK\n');
    
    const systems = {};
    
    try {
      // 1. Check GitHub Tags
      console.log('📊 Checking GitHub tags...');
      execSync('git fetch --tags', { stdio: 'pipe' });
      const gitTags = execSync('git tag --sort=version:refname', { encoding: 'utf8' }).trim().split('\n');
      systems.github = gitTags[gitTags.length - 1]?.replace('v', '') || '1.0.0';
      console.log(`   GitHub Latest: v${systems.github}`);
      
      // 2. Check Package.json
      console.log('📦 Checking package.json...');
      const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
      systems.package = packageJson.version;
      console.log(`   Package.json: v${systems.package}`);
      
      // 3. Check Version API
      console.log('🌐 Checking Version API...');
      const versionResponse = await fetch('http://localhost:3000/api/version');
      const versionData = await versionResponse.json();
      systems.api = versionData.version;
      console.log(`   Version API: v${systems.api}`);
      
      // 4. Check Database Releases
      console.log('🗄️ Checking Database releases...');
      const releasesResponse = await fetch('http://localhost:3000/api/releases');
      const releasesData = await releasesResponse.json();
      
      if (releasesData.releases && releasesData.releases.length > 0) {
        const latestRelease = releasesData.releases.sort((a, b) => {
          const parseVersion = (v) => v.split('.').map(Number);
          const [aMajor, aMinor, aPatch] = parseVersion(a.corrected_version || a.version);
          const [bMajor, bMinor, bPatch] = parseVersion(b.corrected_version || b.version);
          if (bMajor !== aMajor) return bMajor - aMajor;
          if (bMinor !== aMinor) return bMinor - aMinor;
          return bPatch - aPatch;
        })[0];
        systems.database = latestRelease.corrected_version || latestRelease.version;
      } else {
        systems.database = '1.0.0';
      }
      console.log(`   Database: v${systems.database}`);
      
      return systems;
      
    } catch (error) {
      console.error('❌ Error checking systems:', error.message);
      throw error;
    }
  }
  
  static determineAuthoritative(systems) {
    console.log('\n🎯 Determining authoritative version...');
    
    // Priority: Database > GitHub > Package.json > API
    const versions = [systems.database, systems.github, systems.package, systems.api];
    const uniqueVersions = [...new Set(versions)];
    
    if (uniqueVersions.length === 1) {
      console.log(`✅ All systems synchronized at v${uniqueVersions[0]}`);
      return uniqueVersions[0];
    }
    
    // Use database as authoritative if it exists and is valid
    if (systems.database && systems.database !== '1.0.0') {
      console.log(`📊 Using Database as authoritative: v${systems.database}`);
      return systems.database;
    }
    
    // Fall back to GitHub
    console.log(`🏷️ Using GitHub as authoritative: v${systems.github}`);
    return systems.github;
  }
  
  static async syncToTarget(systems, targetVersion) {
    console.log(`\n🔄 Synchronizing all systems to v${targetVersion}...\n`);
    
    let changesMade = false;
    
    // 1. Sync Package.json
    if (systems.package !== targetVersion) {
      console.log(`📦 Updating package.json: v${systems.package} → v${targetVersion}`);
      const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
      packageJson.version = targetVersion;
      writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
      changesMade = true;
    } else {
      console.log('✅ Package.json already synchronized');
    }
    
    // 2. Sync GitHub Tags
    if (systems.github !== targetVersion) {
      console.log(`🏷️ Creating GitHub tag: v${systems.github} → v${targetVersion}`);
      try {
        execSync(`git tag v${targetVersion}`, { stdio: 'pipe' });
        execSync(`git push origin v${targetVersion}`, { stdio: 'pipe' });
        console.log('✅ GitHub tag created and pushed');
        changesMade = true;
      } catch (error) {
        console.log('⚠️ Tag may already exist, continuing...');
      }
    } else {
      console.log('✅ GitHub tags already synchronized');
    }
    
    // 3. Clear Version Cache
    console.log('🗑️ Clearing version cache...');
    try {
      const clearResponse = await fetch('http://localhost:3000/api/admin/clear-version-cache', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      if (clearResponse.ok) {
        console.log('✅ Version cache cleared');
      }
    } catch (error) {
      console.log('⚠️ Cache clear failed, continuing...');
    }
    
    // 4. Verify Database Release Exists
    if (systems.database !== targetVersion) {
      console.log(`🗄️ Database needs release entry for v${targetVersion}`);
      console.log('💡 Run commit-push script to create the missing release');
      changesMade = true;
    } else {
      console.log('✅ Database release entry exists');
    }
    
    return changesMade;
  }
  
  static async validateCommitPushReadiness() {
    console.log('\n🧪 Validating commit-push script readiness...\n');
    
    // Check if there are pending changes
    try {
      const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
      if (gitStatus) {
        console.log('📝 Pending changes detected:');
        gitStatus.split('\n').forEach(line => console.log(`   ${line}`));
      } else {
        console.log('✅ No pending changes - commit-push ready');
      }
    } catch (error) {
      console.log('⚠️ Could not check git status');
    }
    
    // Test commit-push script's version detection
    console.log('🔍 Testing commit-push version detection...');
    try {
      // Simulate the same logic used in commit-push script
      const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
      const packageVersion = packageJson.version;
      
      // Test GitHub version detection (same as commit-push script)
      execSync('git fetch --tags', { stdio: 'pipe' });
      const allTags = execSync('git tag --sort=version:refname', { encoding: 'utf8' }).trim().split('\n');
      const githubVersion = allTags[allTags.length - 1]?.replace('v', '') || '1.0.0';
      
      console.log(`   Package.json version: v${packageVersion}`);
      console.log(`   GitHub latest tag: v${githubVersion}`);
      
      if (packageVersion === githubVersion) {
        console.log('✅ Commit-push will detect synchronized versions');
      } else {
        console.log('⚠️ Commit-push will detect version mismatch');
        console.log(`   Expected behavior: Use GitHub v${githubVersion} as baseline`);
      }
      
    } catch (error) {
      console.log('⚠️ Could not test commit-push version detection');
    }
    
    // Verify semantic-release configuration
    try {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
      if (packageJson.release && packageJson.release.plugins) {
        console.log('✅ Semantic-release configuration found');
        
        // Check if release rules include fix -> patch
        const commitAnalyzer = packageJson.release.plugins.find(p => 
          Array.isArray(p) && p[0] === '@semantic-release/commit-analyzer'
        );
        
        if (commitAnalyzer && commitAnalyzer[1]?.releaseRules) {
          const hasFixRule = commitAnalyzer[1].releaseRules.some(rule => 
            rule.type === 'fix' && rule.release === 'patch'
          );
          
          if (hasFixRule) {
            console.log('✅ Semantic-release will process fix commits as patches');
          } else {
            console.log('⚠️ Semantic-release may not process maintenance changes');
          }
        }
      } else {
        console.log('⚠️ Semantic-release configuration missing');
      }
    } catch (error) {
      console.log('⚠️ Could not verify semantic-release config');
    }
    
    // Verify commit-push script uses fix: for maintenance
    console.log('🔧 Checking commit-push maintenance handling...');
    try {
      const commitPushContent = readFileSync('commit-and-push.js', 'utf8');
      
      if (commitPushContent.includes("type: 'fix'") && commitPushContent.includes("versionImpact: 'PATCH'")) {
        console.log('✅ Commit-push uses fix: for maintenance changes');
      } else if (commitPushContent.includes("type: 'chore'")) {
        console.log('⚠️ Commit-push uses chore: (will not trigger releases)');
      } else {
        console.log('⚠️ Could not determine commit-push maintenance handling');
      }
    } catch (error) {
      console.log('⚠️ Could not check commit-push script');
    }
  }
  
  static calculateNextVersion(currentVersion) {
    const [major, minor, patch] = currentVersion.split('.').map(Number);
    return `${major}.${minor}.${patch + 1}`;
  }
  
  static async run() {
    try {
      console.log('🚀 VERSION SYNCHRONIZATION SCRIPT\n');
      console.log('This script ensures all systems are synchronized and ready for deployment.\n');
      
      // Step 1: Check all systems
      const systems = await this.checkAllSystems();
      
      // Step 2: Determine authoritative version
      const targetVersion = this.determineAuthoritative(systems);
      
      // Step 3: Sync all systems
      const changesMade = await this.syncToTarget(systems, targetVersion);
      
      // Step 4: Validate readiness
      await this.validateCommitPushReadiness();
      
      // Step 5: Final verification
      console.log('\n🔍 Final verification...');
      const finalSystems = await this.checkAllSystems();
      
      const allSynced = Object.values(finalSystems).every(v => v === targetVersion);
      
      if (allSynced) {
        console.log(`\n🎉 ALL SYSTEMS SYNCHRONIZED AT v${targetVersion}`);
        console.log(`\n📈 Next commit-push will create: v${this.calculateNextVersion(targetVersion)}`);
        console.log('\n✅ Ready for commit-push script execution');
      } else {
        console.log('\n⚠️ Some systems still out of sync:');
        Object.entries(finalSystems).forEach(([system, version]) => {
          const status = version === targetVersion ? '✅' : '❌';
          console.log(`   ${status} ${system}: v${version}`);
        });
        console.log('\n💡 Manual intervention may be required');
      }
      
    } catch (error) {
      console.error('\n❌ Synchronization failed:', error.message);
      process.exit(1);
    }
  }
}

// Always run when executed directly
VersionSync.run();

export { VersionSync };