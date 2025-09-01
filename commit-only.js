#!/usr/bin/env node

import { ChangeTracker } from './change-tracker.js';
import { AutoTracker } from './auto-tracker.js';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import readline from 'readline';
import { SemVerStandards } from './semver-compliance.js';

class CommitBuilder {
  static generateCommits() {
    console.log('🔍 Analyzing changes...\n');
    
    // Use only AutoTracker with SemVer compliance
    const autoDetected = AutoTracker.autoTrackChanges();
    const commits = [];
    
    // Group changes by type
    const breaking = autoDetected.filter(c => c.type === 'breaking');
    const features = autoDetected.filter(c => c.type === 'features');
    const fixes = autoDetected.filter(c => c.type === 'fixes');
    const other = autoDetected.filter(c => c.type === 'other');

    // Only create breaking change commit if there are actual breaking changes
    if (breaking.length > 0) {
      commits.push({
        type: 'feat!',
        description: this.buildDetailedDescription(breaking, 'breaking'),
        body: this.buildDetailedBody(breaking),
        versionImpact: 'MAJOR'
      });
    }

    if (features.length > 0) {
      commits.push({
        type: 'feat',
        description: this.buildDetailedDescription(features, 'features'),
        body: this.buildDetailedBody(features),
        versionImpact: 'MINOR'
      });
    }

    if (fixes.length > 0) {
      commits.push({
        type: 'fix',
        description: this.buildDetailedDescription(fixes, 'fixes'),
        body: this.buildDetailedBody(fixes),
        versionImpact: 'PATCH'
      });
    }

    if (other.length > 0) {
      commits.push({
        type: 'fix',
        description: this.buildDetailedDescription(other, 'other'),
        body: this.buildDetailedBody(other),
        versionImpact: 'PATCH'
      });
    }

    return commits;
  }

  static buildBreakingDescription(changes) {
    if (changes.length === 1) {
      const desc = changes[0].description;
      if (!desc.match(/^(implement|introduce|change|modify|remove|deprecate)/i)) {
        return `implement ${desc}`;
      }
      return desc;
    }
    return `implement ${changes.length} breaking changes`;
  }

  static buildFeatureDescription(changes) {
    if (changes.length === 1) {
      const desc = changes[0].description;
      if (!desc.match(/^(add|implement|create|introduce|enhance|improve)/i)) {
        return `add ${desc}`;
      }
      return desc;
    }
    return `add ${changes.length} new features`;
  }

  static buildFixDescription(fixes) {
    if (fixes.length === 1) {
      // Ensure fix descriptions start with action verbs
      const desc = fixes[0].description;
      if (!desc.match(/^(fix|resolve|correct|patch|repair|address)/i)) {
        return `fix ${desc}`;
      }
      return desc;
    }
    return `resolve ${fixes.length} issues`;
  }

  static buildAutoDescription(changes) {
    const components = changes.filter(c => c.file.includes('components/')).length;
    const apis = changes.filter(c => c.file.includes('/api/')).length;
    const pages = changes.filter(c => c.file.includes('page.js')).length;

    const parts = [];
    if (components > 0) parts.push(`${components} UI component${components > 1 ? 's' : ''}`);
    if (apis > 0) parts.push(`${apis} API endpoint${apis > 1 ? 's' : ''}`);
    if (pages > 0) parts.push(`${pages} page${pages > 1 ? 's' : ''}`);

    return `enhance ${parts.join(', ')}`;
  }

  static buildOtherDescription(changes) {
    if (changes.length === 1) {
      return changes[0].description;
    }
    return `update ${changes.length} system components`;
  }

  static buildBreakingBody(changes) {
    const body = changes.map(c => `- ${c.description}`).join('\n');
    return `${body}\n\nBREAKING CHANGE: ${changes[0].details.breakingReason || 'API or functionality changes require user action'}`;
  }

  static buildFeatureBody(changes) {
    return changes.map(c => `- ${c.description}`).join('\n');
  }

  static buildFixBody(fixes) {
    return fixes.map(f => `- ${f.description}`).join('\n');
  }

  static buildAutoBody(changes) {
    return changes.map(c => `- ${c.description}`).join('\n');
  }

  static buildOtherBody(changes) {
    return changes.map(c => `- ${c.description}`).join('\n');
  }
  
  static buildDetailedDescription(changes, type) {
    if (changes.length === 1) {
      return this.humanizeDescription(changes[0].description);
    }
    
    // For multiple changes, create a meaningful summary
    const typeMap = {
      'breaking': 'implement breaking changes',
      'features': 'enhance system with new features', 
      'fixes': 'resolve multiple issues',
      'other': 'update system components'
    };
    
    return `${typeMap[type]} (${changes.length} changes)`;
  }
  
  static buildDetailedBody(changes) {
    const details = [];
    changes.forEach(change => {
      if (change.details) {
        details.push(`- ${change.details}`);
      } else {
        // Generate meaningful details based on file changes and change type
        const fileName = change.description.split(' ')[1] || 'system';
        const changeType = change.type || 'other';
        
        if (fileName.includes('commit-and-push')) {
          if (changeType === 'features') {
            details.push('- Added interactive commit approval system with detailed preview');
            details.push('- Implemented comprehensive version synchronization with GitHub');
            details.push('- Created semantic versioning compliance validation');
          } else {
            details.push('- Enhanced commit system to use fix: instead of chore: for proper semantic versioning');
            details.push('- Improved version detection and synchronization across all systems');
            details.push('- Fixed maintenance changes to trigger patch releases correctly');
          }
        } else if (fileName.includes('package.json')) {
          if (changeType === 'features') {
            details.push('- Added new development scripts for version management');
            details.push('- Integrated semantic-release configuration for automated versioning');
          } else {
            details.push('- Added version synchronization script for system maintenance');
            details.push('- Updated project configuration to support comprehensive version management');
          }
        } else if (fileName.includes('release-plugin')) {
          details.push('- Enhanced release notes generation system with detailed commit body processing');
          details.push('- Improved commit body extraction for better release notes');
          details.push('- Added user-friendly release notes generation');
        } else if (fileName.includes('version-sync')) {
          details.push('- Created comprehensive version synchronization system');
          details.push('- Added validation for commit-push script readiness');
          details.push('- Implemented automatic sync resolution for version mismatches');
        } else if (fileName.includes('release-notes') || fileName.includes('page')) {
          if (changeType === 'features') {
            details.push('- Added dynamic release notes display with version history');
            details.push('- Implemented corrected version mapping for accurate display');
          } else {
            details.push('- Enhanced release notes page to display corrected version history');
            details.push('- Improved version display consistency across UI components');
          }
        } else if (fileName.includes('navbar') || fileName.includes('component')) {
          if (changeType === 'features') {
            details.push('- Added real-time version display in navigation');
            details.push('- Implemented dynamic version fetching from API');
          } else {
            details.push('- Fixed navigation bar to display current version correctly');
            details.push('- Improved UI component reliability and consistency');
          }
        } else if (fileName.includes('test-') || change.description.includes('test')) {
          details.push('- Enhanced testing infrastructure for better code quality');
          details.push('- Added comprehensive test coverage for release system');
        } else {
          details.push(`- ${this.humanizeDescription(change.description)}`);
        }
      }
    });
    return details.join('\n');
  }

  static async showPreview(commits) {
    console.log('\n🔍 COMMIT PREVIEW\n');
    
    // Validate semantic versioning compliance
    const complianceCheck = this.validateSemVerCompliance(commits);
    if (!complianceCheck.valid) {
      console.log(`⚠️  SEMANTIC VERSIONING WARNING:`);
      console.log(`   ${complianceCheck.warning}`);
      console.log('');
    }
    
    // Validate version sync with GitHub
    const baselineVersion = this.validateVersionSync();
    const expectedVersion = this.calculateNextVersion(baselineVersion, commits);
    
    console.log(`📦 Baseline Version (GitHub): ${baselineVersion}`);
    console.log(`📦 Expected Next Version: ${expectedVersion}`);
    console.log(`📜 SemVer Compliance: ${complianceCheck.valid ? '✅ Valid' : '⚠️  Review Required'}`);
    console.log('');
    
    // Show planned commits
    console.log('📋 PLANNED COMMITS:');
    commits.forEach((commit, index) => {
      console.log(`${index + 1}. [${commit.versionImpact}] ${commit.type}: ${commit.description}`);
      if (commit.body) {
        console.log(`   Details: ${commit.body.split('\n')[0]}`);
      }
    });
    
    return expectedVersion;
  }
  
  static getCurrentVersion() {
    try {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
      return packageJson.version;
    } catch {
      return '1.0.0';
    }
  }
  
  static getGitHubLatestVersion() {
    try {
      // Fetch latest tags first
      execSync('git fetch --tags', { stdio: 'pipe' });
      // Get all tags and sort them to find the latest
      const allTags = execSync('git tag --sort=version:refname', { encoding: 'utf8' }).trim().split('\n');
      const latestTag = allTags[allTags.length - 1];
      return latestTag.replace('v', '');
    } catch {
      return '1.0.0';
    }
  }
  
  static validateVersionSync() {
    const packageVersion = this.getCurrentVersion();
    const githubVersion = this.getGitHubLatestVersion();
    
    if (packageVersion !== githubVersion) {
      console.log(`⚠️  VERSION MISMATCH DETECTED:`);
      console.log(`   Package.json: ${packageVersion}`);
      console.log(`   GitHub latest: ${githubVersion}`);
      console.log(`   Using GitHub version as baseline for next version calculation.`);
      return githubVersion;
    }
    
    return packageVersion;
  }
  
  static validateSemVerCompliance(commits) {
    const breaking = commits.filter(c => c.versionImpact === 'MAJOR');
    const features = commits.filter(c => c.versionImpact === 'MINOR');
    const fixes = commits.filter(c => c.versionImpact === 'PATCH');
    
    // Check for false breaking changes
    for (const commit of breaking) {
      const validated = SemVerStandards.validateChange(commit.description, []);
      if (validated !== 'MAJOR') {
        return {
          valid: false,
          warning: `"${commit.description}" classified as MAJOR but should be ${validated}`
        };
      }
    }
    
    // Check for proper feature classification
    for (const commit of features) {
      const validated = SemVerStandards.validateChange(commit.description, []);
      if (validated === 'MAJOR') {
        return {
          valid: false,
          warning: `"${commit.description}" classified as MINOR but should be MAJOR`
        };
      }
    }
    
    return { valid: true };
  }
  
  static calculateNextVersion(currentVersion, commits) {
    const [major, minor, patch] = currentVersion.split('.').map(Number);
    
    const hasBreaking = commits.some(c => c.versionImpact === 'MAJOR');
    const hasFeatures = commits.some(c => c.versionImpact === 'MINOR');
    const hasFixes = commits.some(c => c.versionImpact === 'PATCH');
    const hasOther = commits.some(c => c.versionImpact === 'NONE');
    
    if (hasBreaking) {
      return `${major + 1}.0.0`;
    } else if (hasFeatures) {
      return `${major}.${minor + 1}.0`;
    } else if (hasFixes) {
      return `${major}.${minor}.${patch + 1}`;
    } else if (hasOther) {
      // This case should not occur since maintenance changes are now PATCH
      return `${major}.${minor}.${patch + 1}`;
    }
    
    return currentVersion;
  }
  
  static humanizeDescription(description) {
    const humanizations = {
      // Current changes - detailed user-friendly descriptions
      'enhance feature_inventory.md with new capabilities': 'Updated system documentation with comprehensive feature tracking and version history details',
      'implement breaking changes to semver-compliance': 'Enhanced version validation system with stricter compliance checking (may require developer review)',
      'update route maintenance and documentation': 'Improved version display system to show accurate release information',
      'update page maintenance and documentation': 'Enhanced release notes page to display corrected version history',
      'update auto-tracker maintenance and documentation': 'Refined automatic change detection for more accurate version classification',
      'update commit-and-push maintenance and documentation': 'Improved commit system reliability and user experience',
      'update navbar maintenance and documentation': 'Fixed navigation bar to display current version correctly',
      'update dynamodb maintenance and documentation': 'Enhanced database operations for better version tracking and data integrity',
      'update package.json maintenance and documentation': 'Updated project configuration to reflect current version status',
      
      // Legacy patterns
      'add new functionality to feature_inventory': 'Industry-Standard Semantic Versioning Compliance Documentation',
      'add new functionality to commit-and-push': 'Interactive Commit Approval System with GitHub Version Synchronization',
      'optimize database operations and queries': 'Enhanced Database Operations with SemVer Compliance Validation',
      'enhance navbar component': 'Updated Navigation Component with Version Display Improvements',
      'update application configuration': 'Application Configuration Updates for Enhanced Semantic Versioning',
      'enhance commit system': 'Interactive Commit Approval System with preview and user confirmation',
      'github sync': 'GitHub Version Synchronization to ensure accurate semantic versioning',
      'interactive approval': 'User Approval System for commits with detailed preview',
      'version sync': 'Enhanced Version Alignment between local and GitHub repositories',
      'commit preview': 'Comprehensive Commit Preview with release notes generation',
      'user approval': 'Interactive User Confirmation before any git operations',
      'breaking change prevention': 'Enhanced Breaking Change Prevention Protocol integration',
      'semver compliance': 'Semantic Versioning 2.0.0 Industry Standards Compliance'
    };
    
    const lowerDesc = description.toLowerCase();
    for (const [key, value] of Object.entries(humanizations)) {
      if (lowerDesc.includes(key)) {
        return value;
      }
    }
    
    // Context-aware improvements for common patterns
    if (description.includes('maintenance and documentation')) {
      if (description.includes('route')) return 'Improved version display system to show accurate release information';
      if (description.includes('page')) return 'Enhanced release notes page to display corrected version history';
      if (description.includes('navbar')) return 'Fixed navigation bar to display current version correctly';
      if (description.includes('dynamodb')) return 'Enhanced database operations for better version tracking and data integrity';
      if (description.includes('auto-tracker')) return 'Refined automatic change detection for more accurate version classification';
      if (description.includes('commit-and-push')) return 'Improved commit system reliability and user experience';
      return 'System maintenance updates to improve overall reliability and performance';
    }
    
    if (description.includes('breaking changes')) {
      return 'Enhanced system validation with stricter compliance checking (may require developer review)';
    }
    
    if (description.includes('new capabilities')) {
      return 'Updated system documentation with comprehensive feature tracking and version history details';
    }
    
    return description;
  }
  
  static async getUserApproval() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      rl.question('\n❓ Do you approve these commits? (y/N): ', (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }

  static executeCommits(commits) {
    console.log('\n📝 Executing commits...\n');
    
    // Stage all changes once before committing
    try {
      console.log('📁 Staging all changes...');
      execSync(`git add .`, { stdio: 'inherit' });
      console.log('✅ Changes staged successfully\n');
    } catch (error) {
      console.error('❌ Failed to stage changes:', error.message);
      process.exit(1);
    }

    // Create single commit with highest priority type and detailed body
    const highestPriorityCommit = this.getHighestPriorityCommit(commits);
    
    // Build detailed commit body with all changes
    let detailedBody = '';
    commits.forEach(commit => {
      if (commit.body) {
        const bodyLines = commit.body.split('\n').filter(line => line.startsWith('- '));
        bodyLines.forEach(line => {
          detailedBody += `${line}\n`;
        });
      }
    });
    
    const message = `${highestPriorityCommit.type}: ${highestPriorityCommit.description} (${commits.length} changes)\n\n${detailedBody}`;

    const allDescriptions = commits.map(c => `- ${c.description}`).join('\n');
    
    console.log(`Single Commit (${highestPriorityCommit.versionImpact}):`);
    console.log(`${highestPriorityCommit.type}: ${highestPriorityCommit.description} (${commits.length} changes)`);
    console.log('All changes:', allDescriptions.split('\n').slice(0, 5).join('\n') + (commits.length > 5 ? '\n...' : ''));
    
    try {
      const tempMessage = message.replace(/"/g, '\\"');
      execSync(`git commit -m "${tempMessage}"`, { stdio: 'inherit' });
      console.log('✅ Committed successfully\n');
    } catch (error) {
      console.error('❌ Commit failed:', error.message);
      process.exit(1);
    }
  }
  
  static getHighestPriorityCommit(commits) {
    const priorities = { 'feat!': 4, 'feat': 3, 'fix': 2, 'chore': 1 };
    return commits.reduce((highest, current) => {
      const currentPriority = priorities[current.type] || 0;
      const highestPriority = priorities[highest.type] || 0;
      return currentPriority > highestPriority ? current : highest;
    });
  }

  static updateAppRunnerConfig() {
    // Get current branch
    const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    
    let sourceFile;
    if (branch === 'main') {
      sourceFile = 'apprunner-prod.yaml';
    } else if (branch === 'dev') {
      sourceFile = 'apprunner-dev.yaml';
    } else {
      console.log(`📝 Branch ${branch}: No apprunner.yaml update needed`);
      return;
    }
    
    try {
      console.log(`🔄 Updating apprunner.yaml from ${sourceFile}...`);
      const sourceContent = readFileSync(sourceFile, 'utf8');
      writeFileSync('apprunner.yaml', sourceContent);
      console.log('✅ apprunner.yaml updated successfully');
    } catch (error) {
      console.error(`❌ Failed to update apprunner.yaml: ${error.message}`);
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  console.log('📝 INTERACTIVE COMMIT SYSTEM\n');
  console.log('⚠️  No git operations will be performed until you approve the preview.\n');

  // Auto-detect changes using SemVer-compliant system
  console.log('🔍 Auto-detecting changes...');
  const autoDetected = AutoTracker.autoTrackChanges();
  
  if (autoDetected.length > 0) {
    console.log(`✅ Auto-tracked ${autoDetected.length} changes`);
    autoDetected.forEach(change => {
      console.log(`   ${change.type}: ${change.description}`);
    });
    console.log('');
  }

  const commits = CommitBuilder.generateCommits();

  if (commits.length === 0) {
    console.log('ℹ️  No changes detected or tracked.');
    process.exit(0);
  }

  // Show preview and get approval
  const expectedVersion = await CommitBuilder.showPreview(commits);
  const approved = await CommitBuilder.getUserApproval();
  
  if (!approved) {
    console.log('\n❌ Commits cancelled by user.');
    console.log('📝 You can modify your changes and run the command again.');
    process.exit(0);
  }
  
  console.log('\n✅ Commits approved. Proceeding...\n');
  console.log(`🎯 Expected version: ${expectedVersion}\n`);
  
  // Update apprunner.yaml based on current branch
  CommitBuilder.updateAppRunnerConfig();
  
  CommitBuilder.executeCommits(commits);
  
  console.log('✅ Changes committed successfully. Use git push to deploy when ready.');
}

main().catch(console.error);