#!/usr/bin/env node

import { execSync } from 'child_process';
import { CodeAnalysisEngine } from './code-analysis-engine.js';
import { config } from 'dotenv';

config({ path: '.env.local' });

class VersionReversion {
  static async analyzeAndReversion() {
    console.log('🔍 HISTORICAL VERSION REVERSION\n');
    
    const tags = this.getAllTags();
    console.log(`📋 Found ${tags.length} versions: ${tags.join(', ')}\n`);
    
    const analyses = [];
    
    for (let i = 1; i < tags.length; i++) { // Skip v1.0.0 (initial)
      const currentTag = tags[i];
      const previousTag = tags[i - 1];
      
      console.log(`🔍 Analyzing ${currentTag}...`);
      const analysis = await this.analyzeVersion(currentTag, previousTag);
      analyses.push(analysis);
    }
    
    return this.generateReversionPlan(analyses);
  }
  
  static getAllTags() {
    const output = execSync('git tag --sort=version:refname', { encoding: 'utf8' });
    return output.trim().split('\n').filter(tag => tag.startsWith('v'));
  }
  
  static async analyzeVersion(currentTag, previousTag) {
    try {
      // Get changed files
      const changedFiles = execSync(`git diff --name-only ${previousTag} ${currentTag}`, { encoding: 'utf8' })
        .trim().split('\n').filter(file => file && !file.includes('.json'));
      
      // Analyze each file
      const fileAnalyses = [];
      for (const file of changedFiles.slice(0, 5)) { // Limit to 5 files for speed
        try {
          const diff = execSync(`git diff ${previousTag} ${currentTag} -- "${file}"`, { encoding: 'utf8' });
          if (diff.trim()) {
            const analysis = CodeAnalysisEngine.classifyChanges(diff, file);
            fileAnalyses.push({ file, analysis });
          }
        } catch (error) {
          // Skip files that can't be analyzed
        }
      }
      
      // Determine correct classification
      const hasBreaking = fileAnalyses.some(f => f.analysis.type === 'MAJOR');
      const hasFeatures = fileAnalyses.some(f => f.analysis.type === 'MINOR');
      const hasFixes = fileAnalyses.some(f => f.analysis.type === 'PATCH');
      
      let correctType = 'PATCH';
      if (hasBreaking) correctType = 'MAJOR';
      else if (hasFeatures) correctType = 'MINOR';
      
      // Current version type
      const version = currentTag.replace('v', '');
      const [major, minor, patch] = version.split('.').map(Number);
      const prevVersion = previousTag.replace('v', '');
      const [prevMajor, prevMinor, prevPatch] = prevVersion.split('.').map(Number);
      
      let actualType = 'PATCH';
      if (major > prevMajor) actualType = 'MAJOR';
      else if (minor > prevMinor) actualType = 'MINOR';
      
      const needsReversion = actualType !== correctType;
      
      console.log(`   Current: ${actualType}, Should be: ${correctType}`);
      console.log(`   Files analyzed: ${fileAnalyses.length}`);
      console.log(`   Needs reversion: ${needsReversion ? 'YES' : 'NO'}`);
      console.log('');
      
      return {
        currentTag,
        previousTag,
        actualType,
        correctType,
        needsReversion,
        fileAnalyses: fileAnalyses.length,
        reasoning: this.getReasoningFromAnalyses(fileAnalyses)
      };
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      return null;
    }
  }
  
  static getReasoningFromAnalyses(fileAnalyses) {
    const reasons = [];
    const breaking = fileAnalyses.filter(f => f.analysis.type === 'MAJOR');
    const features = fileAnalyses.filter(f => f.analysis.type === 'MINOR');
    const fixes = fileAnalyses.filter(f => f.analysis.type === 'PATCH');
    
    if (breaking.length > 0) reasons.push(`${breaking.length} breaking changes`);
    if (features.length > 0) reasons.push(`${features.length} new features`);
    if (fixes.length > 0) reasons.push(`${fixes.length} bug fixes`);
    
    return reasons.join(', ') || 'maintenance changes';
  }
  
  static generateReversionPlan(analyses) {
    const validAnalyses = analyses.filter(a => a !== null);
    
    console.log('📊 REVERSION ANALYSIS SUMMARY\n');
    console.log(`Total versions analyzed: ${validAnalyses.length}`);
    
    // Build cascading corrected version sequence
    const plan = [];
    let correctedVersions = new Map();
    let needsCascade = false;
    
    // Set baseline
    correctedVersions.set('v1.0.0', 'v1.0.0');
    
    for (const analysis of validAnalyses) {
      const previousCorrected = correctedVersions.get(analysis.previousTag);
      const correctVersion = this.calculateCascadingVersion(previousCorrected, analysis.correctType);
      
      correctedVersions.set(analysis.currentTag, correctVersion);
      
      const needsReversion = analysis.currentTag !== correctVersion;
      if (needsReversion) needsCascade = true;
      
      if (needsReversion || needsCascade) {
        plan.push({
          originalVersion: analysis.currentTag,
          correctVersion,
          reason: needsReversion 
            ? `Should be ${analysis.correctType} not ${analysis.actualType}: ${analysis.reasoning}`
            : `Cascading correction from earlier version changes`,
          actualType: analysis.actualType,
          correctType: analysis.correctType,
          isCascade: !needsReversion
        });
      }
    }
    
    console.log(`Versions needing correction: ${plan.length}\n`);
    
    if (plan.length === 0) {
      console.log('✅ All versions are correctly classified!');
      return { needsReversion: false, plan: [] };
    }
    
    console.log('📋 CASCADING REVERSION PLAN:\n');
    
    for (const item of plan) {
      console.log(`${item.originalVersion} → ${item.correctVersion}`);
      if (item.isCascade) {
        console.log(`   Reason: Cascading correction`);
      } else {
        console.log(`   Reason: ${item.correctType} changes detected (${item.reason.split(': ')[1]})`);
      }
      console.log('');
    }
    
    return { needsReversion: true, plan };
  }
  
  static calculateCascadingVersion(previousVersion, changeType) {
    const version = previousVersion.replace('v', '');
    const [major, minor, patch] = version.split('.').map(Number);
    
    switch (changeType) {
      case 'MAJOR': return `v${major + 1}.0.0`;
      case 'MINOR': return `v${major}.${minor + 1}.0`;
      case 'PATCH': return `v${major}.${minor}.${patch + 1}`;
      default: return previousVersion;
    }
  }
  
  static async executeReversion(plan) {
    if (!plan.needsReversion) {
      console.log('✅ No reversion needed.');
      return;
    }
    
    console.log('🔄 EXECUTING REVERSION PLAN\n');
    
    for (const item of plan.plan) {
      console.log(`Updating ${item.originalVersion} → ${item.correctVersion}...`);
      
      try {
        const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/admin/reversion-release`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            originalVersion: item.originalVersion.replace('v', ''),
            correctVersion: item.correctVersion.replace('v', ''),
            reason: item.reason
          })
        });
        
        if (response.ok) {
          console.log(`✅ Updated database for ${item.correctVersion}`);
        } else {
          console.log(`❌ Failed to update ${item.originalVersion}: ${response.statusText}`);
        }
      } catch (error) {
        console.log(`❌ Failed to update ${item.originalVersion}: ${error.message}`);
      }
    }
    
    console.log('\n✅ Reversion completed!');
  }
}

async function main() {
  try {
    const reversionPlan = await VersionReversion.analyzeAndReversion();
    
    if (reversionPlan.needsReversion) {
      console.log('\n❓ Execute reversion plan? (This will update the database)');
      console.log('   Run with --execute flag to proceed');
      
      if (process.argv.includes('--execute')) {
        await VersionReversion.executeReversion(reversionPlan);
      }
    }
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

main();