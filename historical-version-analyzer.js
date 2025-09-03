#!/usr/bin/env node

// Historical Version Analyzer - Reversion existing releases using intelligent code analysis

import { execSync } from 'child_process';
import { CodeAnalysisEngine } from './code-analysis-engine.js';
import { config } from 'dotenv';

config({ path: '.env.local' });

export class HistoricalVersionAnalyzer {
  
  static async analyzeAllVersions() {
    console.log('🔍 HISTORICAL VERSION ANALYSIS\n');
    
    // Get all existing tags
    const tags = this.getAllTags();
    console.log(`📋 Found ${tags.length} existing versions: ${tags.join(', ')}\n`);
    
    const analyses = [];
    
    for (let i = 0; i < tags.length; i++) {
      const currentTag = tags[i];
      const previousTag = i > 0 ? tags[i - 1] : null;
      
      console.log(`🔍 Analyzing ${currentTag}...`);
      const analysis = await this.analyzeVersionChanges(currentTag, previousTag);
      analyses.push(analysis);
    }
    
    return this.generateReversionPlan(analyses);
  }
  
  static getAllTags() {
    try {
      const output = execSync('git tag --sort=version:refname', { encoding: 'utf8' });
      return output.trim().split('\n').filter(tag => tag.startsWith('v'));
    } catch (error) {
      console.error('❌ Error getting tags:', error.message);
      return [];
    }
  }
  
  static async analyzeVersionChanges(currentTag, previousTag) {
    const commitRange = previousTag ? `${previousTag}..${currentTag}` : currentTag;
    
    try {
      // Get commits in this version
      const commits = execSync(`git log ${commitRange} --oneline`, { encoding: 'utf8' })
        .trim().split('\n').filter(line => line);
      
      // Get changed files in this version
      const changedFiles = execSync(`git diff --name-only ${previousTag || 'HEAD~1'} ${currentTag}`, { encoding: 'utf8' })
        .trim().split('\n').filter(file => file);
      
      // Analyze each changed file
      const fileAnalyses = [];
      for (const file of changedFiles) {
        try {
          const analysis = await this.analyzeHistoricalFile(file, currentTag, previousTag);
          if (analysis) {
            fileAnalyses.push(analysis);
          }
        } catch (error) {
          console.log(`   ⚠️  Could not analyze ${file}: ${error.message}`);
        }
      }
      
      // Determine correct version type
      const correctClassification = this.determineCorrectVersion(fileAnalyses);
      const actualVersion = this.parseVersion(currentTag);
      const correctVersion = this.calculateCorrectVersion(previousTag, correctClassification);
      
      console.log(`   Current: ${currentTag} (${actualVersion.type})`);
      console.log(`   Should be: ${correctVersion} (${correctClassification})`);
      console.log(`   Files analyzed: ${fileAnalyses.length}`);
      console.log('');
      
      return {\n        currentTag,\n        previousTag,\n        commits,\n        changedFiles,\n        fileAnalyses,\n        actualVersion,\n        correctClassification,\n        correctVersion,\n        needsReversion: currentTag !== correctVersion\n      };\n    } catch (error) {\n      console.error(`   ❌ Error analyzing ${currentTag}:`, error.message);\n      return null;\n    }\n  }\n  \n  static async analyzeHistoricalFile(file, currentTag, previousTag) {\n    try {\n      // Get the diff for this file in this version\n      const diffCommand = previousTag \n        ? `git diff ${previousTag} ${currentTag} -- \"${file}\"`\n        : `git show ${currentTag} -- \"${file}\"`;\n      \n      const diff = execSync(diffCommand, { encoding: 'utf8' });\n      \n      if (!diff.trim()) {\n        return null;\n      }\n      \n      // Use our code analysis engine to classify the changes\n      const analysis = CodeAnalysisEngine.classifyChanges(diff, file);\n      \n      return {\n        file,\n        analysis,\n        diff: diff.split('\\n').slice(0, 10).join('\\n') + '...' // First 10 lines for reference\n      };\n    } catch (error) {\n      return null;\n    }\n  }\n  \n  static determineCorrectVersion(fileAnalyses) {\n    if (!fileAnalyses.length) return 'PATCH';\n    \n    // Aggregate all analyses\n    const hasBreaking = fileAnalyses.some(f => f.analysis.type === 'MAJOR');\n    const hasFeatures = fileAnalyses.some(f => f.analysis.type === 'MINOR');\n    const hasFixes = fileAnalyses.some(f => f.analysis.type === 'PATCH');\n    \n    if (hasBreaking) return 'MAJOR';\n    if (hasFeatures) return 'MINOR';\n    if (hasFixes) return 'PATCH';\n    return 'PATCH';\n  }\n  \n  static parseVersion(tag) {\n    const version = tag.replace('v', '');\n    const [major, minor, patch] = version.split('.').map(Number);\n    \n    // Determine what type of change this was based on version increment\n    const prevMajor = major > 1 ? major - 1 : 0;\n    const prevMinor = minor > 0 ? minor - 1 : 0;\n    const prevPatch = patch > 0 ? patch - 1 : 0;\n    \n    let type = 'PATCH';\n    if (major > 1 || (major === 1 && minor === 0 && patch === 0)) type = 'MAJOR';\n    else if (minor > 0 && patch === 0) type = 'MINOR';\n    \n    return { major, minor, patch, type };\n  }\n  \n  static calculateCorrectVersion(previousTag, classification) {\n    if (!previousTag) {\n      return 'v1.0.0'; // First version\n    }\n    \n    const prevVersion = previousTag.replace('v', '');\n    const [major, minor, patch] = prevVersion.split('.').map(Number);\n    \n    switch (classification) {\n      case 'MAJOR':\n        return `v${major + 1}.0.0`;\n      case 'MINOR':\n        return `v${major}.${minor + 1}.0`;\n      case 'PATCH':\n      default:\n        return `v${major}.${minor}.${patch + 1}`;\n    }\n  }\n  \n  static generateReversionPlan(analyses) {\n    const validAnalyses = analyses.filter(a => a !== null);\n    const needsReversion = validAnalyses.filter(a => a.needsReversion);\n    \n    console.log('📊 REVERSION ANALYSIS SUMMARY\\n');\n    console.log(`Total versions analyzed: ${validAnalyses.length}`);\n    console.log(`Versions needing reversion: ${needsReversion.length}\\n`);\n    \n    if (needsReversion.length === 0) {\n      console.log('✅ All versions are correctly classified!');\n      return { needsReversion: false, plan: [] };\n    }\n    \n    console.log('📋 REVERSION PLAN:\\n');\n    \n    const plan = [];\n    let correctedVersions = new Map();\n    \n    // Build corrected version sequence\n    for (const analysis of validAnalyses) {\n      const correctVersion = this.calculateCorrectedVersion(analysis, correctedVersions);\n      correctedVersions.set(analysis.currentTag, correctVersion);\n      \n      if (analysis.needsReversion) {\n        plan.push({\n          originalVersion: analysis.currentTag,\n          correctVersion: correctVersion,\n          reason: `Should be ${analysis.correctClassification} not ${analysis.actualVersion.type}`,\n          changes: analysis.fileAnalyses.length,\n          commits: analysis.commits.length\n        });\n        \n        console.log(`${analysis.currentTag} → ${correctVersion}`);\n        console.log(`   Reason: ${analysis.correctClassification} changes detected`);\n        console.log(`   Files: ${analysis.fileAnalyses.length}, Commits: ${analysis.commits.length}`);\n        console.log('');\n      }\n    }\n    \n    return { needsReversion: true, plan, correctedVersions };\n  }\n  \n  static calculateCorrectedVersion(analysis, correctedVersions) {\n    // Use the corrected previous version if available\n    const prevTag = analysis.previousTag;\n    const correctedPrevious = prevTag ? correctedVersions.get(prevTag) : null;\n    const baseVersion = correctedPrevious || prevTag || 'v0.0.0';\n    \n    return this.calculateCorrectVersion(baseVersion, analysis.correctClassification);\n  }\n  \n  static async executeReversion(plan) {\n    if (!plan.needsReversion) {\n      console.log('✅ No reversion needed.');\n      return;\n    }\n    \n    console.log('🔄 EXECUTING REVERSION PLAN\\n');\n    \n    for (const item of plan.plan) {\n      console.log(`Updating ${item.originalVersion} → ${item.correctVersion}...`);\n      \n      try {\n        // Update database with corrected version\n        await this.updateDatabaseVersion(item.originalVersion, item.correctVersion, item.reason);\n        console.log(`✅ Updated database for ${item.correctVersion}`);\n      } catch (error) {\n        console.error(`❌ Failed to update ${item.originalVersion}:`, error.message);\n      }\n    }\n    \n    console.log('\\n✅ Reversion completed!');\n  }\n  \n  static async updateDatabaseVersion(originalVersion, correctVersion, reason) {\n    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/admin/reversion-release`, {\n      method: 'POST',\n      headers: {\n        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`,\n        'Content-Type': 'application/json'\n      },\n      body: JSON.stringify({\n        originalVersion: originalVersion.replace('v', ''),\n        correctVersion: correctVersion.replace('v', ''),\n        reason\n      })\n    });\n    \n    if (!response.ok) {\n      throw new Error(`HTTP ${response.status}: ${response.statusText}`);\n    }\n  }\n}\n\n// Main execution\nasync function main() {\n  try {\n    const reversionPlan = await HistoricalVersionAnalyzer.analyzeAllVersions();\n    \n    if (reversionPlan.needsReversion) {\n      console.log('\\n❓ Execute reversion plan? (This will update the database)');\n      console.log('   Run with --execute flag to proceed');\n      \n      if (process.argv.includes('--execute')) {\n        await HistoricalVersionAnalyzer.executeReversion(reversionPlan);\n      }\n    }\n  } catch (error) {\n    console.error('❌ Analysis failed:', error.message);\n  }\n}\n\nif (import.meta.url === `file://${process.argv[1]}`) {\n  main();\n}