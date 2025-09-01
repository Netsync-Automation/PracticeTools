#!/usr/bin/env node

// Intelligent Code Analysis Engine for Semantic Versioning Classification

import { execSync } from 'child_process';

export class CodeAnalysisEngine {
  
  // Semantic Versioning Knowledge Base
  static SEMVER_KNOWLEDGE_BASE = {
    
    // MAJOR (Breaking Changes) - Require user action
    BREAKING_PATTERNS: {
      // Function/Method Changes - Only actual breaking changes
      functionSignature: [
        /^-.*export\s+(function|const|let)\s+(\w+)/gm,  // Removed exports
        /^-.*function\s+(\w+)\s*\([^)]*\)/gm,           // Removed functions
        /^\+.*export\s+(function|const|let)\s+(\w+).*BREAKING/gm, // Explicitly marked breaking
        /^-.*\w+\s*:\s*\([^)]*\)\s*=>/gm                // Removed arrow functions
      ],
      
      // API Changes
      apiChanges: [
        /app\.(get|post|put|delete|patch)\s*\(['"`]([^'"`]+)['"`]/g,  // Route changes
        /router\.(get|post|put|delete|patch)\s*\(['"`]([^'"`]+)['"`]/g,  // Router changes
        /export\s+.*\s+from\s+['"`].*['"`]/g  // Export changes
      ],
      
      // Database Schema
      schemaChanges: [
        /CREATE\s+TABLE/gi,
        /ALTER\s+TABLE/gi,
        /DROP\s+(TABLE|COLUMN)/gi,
        /TableName:\s*['"`]([^'"`]+)['"`]/g  // DynamoDB table changes
      ],
      
      // Configuration Changes - Only breaking config changes
      configChanges: [
        /^-.*process\.env\.\w+/gm,  // Removed environment variables
        /^-.*config\.\w+/gm,        // Removed configuration properties
        /BREAKING.*CONFIG/gi,        // Explicitly marked breaking config
        /DEPRECATED.*CONFIG/gi       // Deprecated configuration
      ]
    },
    
    // MINOR (New Features) - Backward compatible additions
    FEATURE_PATTERNS: {
      // New Functions/Methods - Only new exports or major additions
      newFunctions: [
        /^\+.*export\s+(function|const)\s+(\w+)/gm, // New exported functions
        /^\+.*export\s+default\s+function/gm,       // New default exports
        /^\+.*export\s+class\s+(\w+)/gm             // New exported classes
      ],
      
      // New API Endpoints - Actual new routes
      newEndpoints: [
        /^\+.*app\.(get|post|put|delete|patch)\(['"`]\/[^'"`]+['"`]/gm,
        /^\+.*router\.(get|post|put|delete|patch)\(['"`]\/[^'"`]+['"`]/gm
      ],
      
      // New Components/Pages - Actual new UI components
      newComponents: [
        /^\+.*export\s+default\s+function\s+(\w+)/gm, // New React components
        /^\+.*page\.js$/gm,                          // New pages
        /^\+.*component\.js$/gm                      // New component files
      ],
      
      // New Major Features - Significant additions
      newCapabilities: [
        /^\+.*new\s+feature/gi,           // Explicitly marked new features
        /^\+.*implement\s+\w+/gi,         // Implementation of new functionality
        /^\+.*add\s+\w+\s+functionality/gi // Adding functionality
      ]
    },
    
    // PATCH (Bug Fixes) - Backward compatible fixes
    FIX_PATTERNS: {
      // Explicit Bug Fixes
      bugFixes: [
        /^\+.*fix\s+/gi,                  // Explicit fix mentions
        /^\+.*resolve\s+/gi,              // Resolve mentions
        /^\+.*correct\s+/gi,              // Correction mentions
        /^\+.*patch\s+/gi,                // Patch mentions
        /^\+.*repair\s+/gi                // Repair mentions
      ],
      
      // Error Handling Improvements
      errorHandling: [
        /^\+.*try\s*{[^}]*catch/gm,       // Complete try-catch blocks
        /^\+.*\.catch\(/gm,               // Promise error handling
        /^\+.*error\s*:/gm,               // Error handling
        /^\+.*console\.(error|warn)/gm    // Error logging
      ],
      
      // Null/Undefined Safety
      safety: [
        /^\+.*\?\./gm,                    // Optional chaining
        /^\+.*\|\|\s*['"`]/gm,            // Default values
        /^\+.*!==\s*(null|undefined)/gm,  // Explicit null checks
        /^\+.*typeof\s+\w+\s*!==\s*['"`]undefined['"`]/gm // Type checks
      ],
      
      // Validation Improvements
      validation: [
        /^\+.*\.trim\(\)/gm,              // Input sanitization
        /^\+.*validate\w*/gi,             // Validation functions
        /^\+.*isValid/gi,                 // Validation checks
        /^\+.*sanitize/gi                 // Input sanitization
      ]
    },
    
    // NO VERSION (Maintenance) - No functional changes
    MAINTENANCE_PATTERNS: {
      // Documentation Only
      documentation: [
        /^\+.*\/\*\*[^*]*\*\//gm,         // JSDoc comments
        /^\+.*\/\/\s*TODO/gm,             // TODO comments
        /^\+.*\/\/\s*FIXME/gm,            // FIXME comments
        /^\+.*README/gm,                  // README changes
        /^\+.*\.md\s*$/gm                 // Markdown files only
      ],
      
      // Pure Code Style (no logic changes)
      codeStyle: [
        /^\+\s*$/gm,                      // Empty lines only
        /^\+\s*;\s*$/gm,                  // Semicolons only
        /^\+\s*,\s*$/gm,                  // Commas only
        /^\+\s*}\s*$/gm                   // Closing braces only
      ],
      
      // Testing Only (no production code)
      testing: [
        /\.test\.(js|ts|jsx|tsx)$/,       // Test files only
        /\.spec\.(js|ts|jsx|tsx)$/,       // Spec files only
        /__tests__\//,                    // Test directories
        /^\+.*describe\(['"`][^'"`]*test/gm // Test descriptions
      ]
    }
  };
  
  static analyzeCodeChanges(file) {
    try {
      const diff = execSync(`git diff HEAD -- "${file}"`, { encoding: 'utf8' });
      return this.classifyChanges(diff, file);
    } catch (error) {
      return { type: 'MINOR', confidence: 0.5, reasoning: 'Unable to analyze diff' };
    }
  }
  
  static classifyChanges(diff, file) {
    const analysis = {
      breaking: this.analyzePatterns(diff, this.SEMVER_KNOWLEDGE_BASE.BREAKING_PATTERNS),
      features: this.analyzePatterns(diff, this.SEMVER_KNOWLEDGE_BASE.FEATURE_PATTERNS),
      fixes: this.analyzePatterns(diff, this.SEMVER_KNOWLEDGE_BASE.FIX_PATTERNS),
      maintenance: this.analyzePatterns(diff, this.SEMVER_KNOWLEDGE_BASE.MAINTENANCE_PATTERNS)
    };
    
    // Apply file context and priority rules
    const contextualScores = this.applyContextualRules(analysis, file, diff);
    
    // Determine classification with priority order
    let classification = 'NONE';
    let maxScore = 0;
    
    // Priority order: MAJOR > MINOR > PATCH > NONE
    if (contextualScores.MAJOR > 0.3) {
      classification = 'MAJOR';
      maxScore = contextualScores.MAJOR;
    } else if (contextualScores.MINOR > 0.2) {
      classification = 'MINOR';
      maxScore = contextualScores.MINOR;
    } else if (contextualScores.PATCH > 0.1) {
      classification = 'PATCH';
      maxScore = contextualScores.PATCH;
    } else {
      classification = 'NONE';
      maxScore = contextualScores.NONE;
    }
    
    // Generate reasoning
    const reasoning = this.generateReasoning(analysis, classification, file);
    
    return {
      type: classification,
      confidence: maxScore,
      reasoning: reasoning,
      details: analysis
    };
  }
  
  static applyContextualRules(analysis, file, diff) {
    const scores = {
      MAJOR: analysis.breaking.score,
      MINOR: analysis.features.score,
      PATCH: analysis.fixes.score,
      NONE: analysis.maintenance.score
    };
    
    // File type context
    if (file.includes('.test.') || file.includes('.spec.') || file.includes('__tests__/')) {
      // Test files are usually maintenance unless they test new features
      scores.NONE += 0.5;
      scores.MAJOR = Math.max(0, scores.MAJOR - 0.3);
    }
    
    if (file.includes('README') || file.includes('.md')) {
      // Documentation is maintenance
      scores.NONE += 0.8;
      scores.MAJOR = 0;
      scores.MINOR = 0;
      scores.PATCH = 0;
    }
    
    // Content context - look for explicit keywords
    if (diff.includes('fix:') || diff.includes('Fix:') || diff.includes('resolve:')) {
      scores.PATCH += 0.4;
      scores.MAJOR = Math.max(0, scores.MAJOR - 0.2);
    }
    
    if (diff.includes('feat:') || diff.includes('Feature:') || diff.includes('add:')) {
      scores.MINOR += 0.4;
    }
    
    if (diff.includes('BREAKING:') || diff.includes('Breaking:')) {
      scores.MAJOR += 0.6;
    }
    
    // Normalize scores
    Object.keys(scores).forEach(key => {
      scores[key] = Math.min(1.0, Math.max(0, scores[key]));
    });
    
    return scores;
  }
  
  static analyzePatterns(diff, patternGroups) {
    let totalMatches = 0;
    let matchedPatterns = [];
    
    for (const [category, patterns] of Object.entries(patternGroups)) {
      for (const pattern of patterns) {
        const matches = diff.match(pattern) || [];
        if (matches.length > 0) {
          totalMatches += matches.length;
          matchedPatterns.push({ category, count: matches.length, examples: matches.slice(0, 3) });
        }
      }
    }
    
    return {
      score: Math.min(totalMatches / 10, 1.0), // Normalize to 0-1
      matches: matchedPatterns
    };
  }
  
  static generateReasoning(analysis, classification, file) {
    const reasons = [];
    
    switch (classification) {
      case 'MAJOR':
        if (analysis.breaking.matches.length > 0) {
          reasons.push(`Breaking changes detected: ${analysis.breaking.matches.map(m => m.category).join(', ')}`);
        }
        break;
        
      case 'MINOR':
        if (analysis.features.matches.length > 0) {
          reasons.push(`New features detected: ${analysis.features.matches.map(m => m.category).join(', ')}`);
        }
        break;
        
      case 'PATCH':
        if (analysis.fixes.matches.length > 0) {
          reasons.push(`Bug fixes detected: ${analysis.fixes.matches.map(m => m.category).join(', ')}`);
        }
        break;
        
      case 'NONE':
        if (analysis.maintenance.matches.length > 0) {
          reasons.push(`Maintenance changes: ${analysis.maintenance.matches.map(m => m.category).join(', ')}`);
        }
        break;
    }
    
    // Add file context
    if (file.includes('test') || file.includes('spec')) {
      reasons.push('Test file changes typically indicate maintenance');
    }
    
    if (file.includes('README') || file.includes('.md')) {
      reasons.push('Documentation changes are maintenance');
    }
    
    return reasons.join('; ') || 'Standard code changes detected';
  }
  
  static analyzeMultipleFiles(files) {
    const analyses = files.map(file => ({
      file,
      analysis: this.analyzeCodeChanges(file)
    }));
    
    // Aggregate results
    const aggregated = {
      MAJOR: Math.max(...analyses.map(a => a.analysis.type === 'MAJOR' ? a.analysis.confidence : 0)),
      MINOR: Math.max(...analyses.map(a => a.analysis.type === 'MINOR' ? a.analysis.confidence : 0)),
      PATCH: Math.max(...analyses.map(a => a.analysis.type === 'PATCH' ? a.analysis.confidence : 0)),
      NONE: Math.max(...analyses.map(a => a.analysis.type === 'NONE' ? a.analysis.confidence : 0))
    };
    
    const finalType = Object.keys(aggregated).reduce((a, b) => 
      aggregated[a] > aggregated[b] ? a : b
    );
    
    return {
      type: finalType,
      confidence: aggregated[finalType],
      fileAnalyses: analyses,
      reasoning: `Analyzed ${files.length} files: ${finalType} changes detected with ${(aggregated[finalType] * 100).toFixed(0)}% confidence`
    };
  }
}

export default CodeAnalysisEngine;