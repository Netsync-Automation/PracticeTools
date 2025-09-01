#!/usr/bin/env node

import { VersioningSystem } from '../lib/versioning.js';
import { db } from '../lib/database.js';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import readline from 'readline';

class CommitBuilder {
  static async generateCommits() {
    console.log('🔍 Analyzing changes...\n');
    
    const changes = await VersioningSystem.getChangesSinceLastCommit();
    const commits = [];
    
    if (changes.added.length > 0) {
      commits.push({
        type: 'feat',
        description: `Add ${changes.added.length} new file(s)`,
        versionImpact: 'MINOR'
      });
    }
    
    if (changes.modified.length > 0) {
      commits.push({
        type: 'fix',
        description: `Update ${changes.modified.length} file(s)`,
        versionImpact: 'PATCH'
      });
    }
    
    if (changes.deleted.length > 0) {
      commits.push({
        type: 'feat!',
        description: `Remove ${changes.deleted.length} file(s)`,
        versionImpact: 'MAJOR'
      });
    }

    return commits;
  }

  static async showPreview(commits) {
    console.log('\n🔍 COMMIT & VERSION PREVIEW\n');
    
    const currentVersion = await VersioningSystem.getCurrentVersion();
    console.log(`📦 Current Version: ${currentVersion}`);
    
    const changeTypes = this.categorizeChanges(commits);
    const versionType = changeTypes.breaking ? 'major' : 
                       changeTypes.features ? 'minor' : 'patch';
    const nextVersion = VersioningSystem.incrementVersion(currentVersion, versionType);
    
    console.log(`📦 Next Version: ${nextVersion}`);
    console.log(`📊 Change Types: Breaking: ${changeTypes.breaking}, Features: ${changeTypes.features}, Fixes: ${changeTypes.fixes}`);
    
    const releaseNotes = this.generateReleaseNotes(commits, nextVersion, changeTypes);
    console.log('\n📝 RELEASE NOTES PREVIEW:');
    console.log(releaseNotes);
    
    console.log('\n📋 PLANNED COMMITS:');
    commits.forEach((commit, index) => {
      console.log(`${index + 1}. [${commit.versionImpact}] ${commit.type}: ${commit.description}`);
    });
    
    return { nextVersion, releaseNotes, changeTypes };
  }

  static async getUserApproval() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      rl.question('\n❓ Do you approve this version and release? (y/N): ', (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }
  
  static categorizeChanges(commits) {
    return {
      breaking: commits.some(c => c.versionImpact === 'MAJOR'),
      features: commits.some(c => c.versionImpact === 'MINOR'),
      fixes: commits.some(c => c.versionImpact === 'PATCH')
    };
  }
  
  static generateReleaseNotes(commits, version, changeTypes) {
    const date = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    let notes = `# 🎉 Version ${version}\n\n`;
    
    if (changeTypes.breaking) {
      notes += `## 🚀 Major Update\n\nSignificant changes that enhance your experience with Practice Tools.\n\n`;
    } else if (changeTypes.features) {
      notes += `## ✨ Feature Update\n\nNew features and enhancements to make Practice Tools even better.\n\n`;
    } else {
      notes += `## 🔧 Maintenance Update\n\nBug fixes and improvements to keep everything running smoothly.\n\n`;
    }
    
    const breaking = commits.filter(c => c.versionImpact === 'MAJOR');
    const features = commits.filter(c => c.versionImpact === 'MINOR');
    const fixes = commits.filter(c => c.versionImpact === 'PATCH');
    
    if (breaking.length > 0) {
      notes += `### 🚨 Breaking Changes\n\n`;
      breaking.forEach(commit => {
        notes += `- ${commit.description}\n`;
      });
      notes += '\n';
    }
    
    if (features.length > 0) {
      notes += `### ✨ New Features\n\n`;
      features.forEach(commit => {
        notes += `- ${commit.description}\n`;
      });
      notes += '\n';
    }
    
    if (fixes.length > 0) {
      notes += `### 🐛 Bug Fixes\n\n`;
      fixes.forEach(commit => {
        notes += `- ${commit.description}\n`;
      });
      notes += '\n';
    }
    
    notes += `---\n\n**📅 Released:** ${date}\n**📦 Version:** ${version}\n\n*Thank you for using Practice Tools! 🙏*`;
    
    return notes;
  }
}

async function main() {
  console.log('🚀 PRACTICE TOOLS VERSIONING SYSTEM\n');

  const commits = await CommitBuilder.generateCommits();

  if (commits.length === 0) {
    console.log('ℹ️  No changes detected.');
    process.exit(0);
  }

  const { nextVersion, releaseNotes, changeTypes } = await CommitBuilder.showPreview(commits);
  
  const approved = await CommitBuilder.getUserApproval();
  
  if (!approved) {
    console.log('\n❌ Process cancelled by user.');
    process.exit(0);
  }
  
  console.log('\n✅ Process approved. Proceeding...\n');
  
  try {
    console.log(`📊 Updating database with version ${nextVersion}...`);
    const result = await VersioningSystem.createRelease({
      features: commits.filter(c => c.versionImpact === 'MINOR').map(c => c.description),
      improvements: [],
      bugFixes: commits.filter(c => c.versionImpact === 'PATCH').map(c => c.description),
      breaking: commits.filter(c => c.versionImpact === 'MAJOR').map(c => c.description),
      notes: releaseNotes
    }, changeTypes.breaking ? 'major' : changeTypes.features ? 'minor' : 'patch');
    
    if (result.success) {
      console.log('✅ Database updated successfully');
      
      // Stage all changes
      execSync('git add .', { stdio: 'inherit' });
      
      // Create commit
      const commitMessage = `release: ${nextVersion}`;
      execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
      
      // Push to repository
      const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
      execSync(`git push origin ${branch}`, { stdio: 'inherit' });
      
      console.log('\n✅ SUCCESS! Versioning completed:');
      console.log(`   📦 Version: ${nextVersion}`);
      console.log(`   📊 Database: Updated`);
      console.log(`   🚀 Deployed: ${branch} branch`);
    } else {
      console.error('❌ Failed to update database:', result.error);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Error during process:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);