#!/usr/bin/env node

/**
 * Semantic Versioning Calculator
 * Handles version calculation for both dev and prod environments
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { db } from './lib/dynamodb.js';

export class SemanticVersioner {
  
  static validateSemVerCompliance(changeTypes, commits) {
    const warnings = [];
    
    // Validate breaking changes are properly classified
    if (changeTypes.breaking) {
      const breakingCommits = commits.filter(c => c.versionImpact === 'MAJOR');
      for (const commit of breakingCommits) {
        if (!this.isValidBreakingChange(commit.description)) {
          warnings.push(`"${commit.description}" may not be a true breaking change`);
        }
      }
    }
    
    // Validate feature changes don't contain breaking changes
    if (changeTypes.features) {
      const featureCommits = commits.filter(c => c.versionImpact === 'MINOR');
      for (const commit of featureCommits) {
        if (this.containsBreakingChange(commit.description)) {
          warnings.push(`"${commit.description}" appears to be breaking but classified as feature`);
        }
      }
    }
    
    // Validate version increment logic
    if (changeTypes.breaking && (changeTypes.features || changeTypes.fixes)) {
      // This is correct - breaking changes can include features and fixes
    } else if (changeTypes.features && changeTypes.fixes) {
      // This is correct - feature releases can include fixes
    }
    
    return {
      valid: warnings.length === 0,
      warnings: warnings
    };
  }
  
  static isValidBreakingChange(description) {
    const breakingIndicators = [
      'remove', 'delete', 'deprecate', 'breaking',
      'incompatible', 'major change', 'api change',
      'schema change', 'database migration'
    ];
    
    const lowerDesc = description.toLowerCase();
    return breakingIndicators.some(indicator => lowerDesc.includes(indicator));
  }
  
  static containsBreakingChange(description) {
    const breakingKeywords = [
      'breaking change', 'remove', 'delete', 'deprecate',
      'incompatible', 'major refactor', 'api breaking'
    ];
    
    const lowerDesc = description.toLowerCase();
    return breakingKeywords.some(keyword => lowerDesc.includes(keyword));
  }
  
  static validateVersionFormat(version) {
    // SemVer 2.0.0 format validation
    const semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
    
    if (!semverRegex.test(version)) {
      return {
        valid: false,
        error: `Version "${version}" does not follow SemVer 2.0.0 format`
      };
    }
    
    return { valid: true };
  }
  static getTableName(environment) {
    return environment === 'prod' 
      ? 'PracticeTools-prod-Releases'
      : 'PracticeTools-dev-Releases';
  }
  
  static async getCurrentVersion(environment) {
    try {
      const table = this.getTableName(environment);
      const releases = await db.getReleases();
      
      if (!releases || releases.length === 0) {
        return environment === 'prod' ? '1.0.0' : '1.0.0-dev.0';
      }
      
      // Filter releases for the correct environment
      const envReleases = releases.filter(release => {
        if (environment === 'prod') {
          return !release.version.includes('-dev.');
        } else {
          return release.version.includes('-dev.');
        }
      });
      
      if (envReleases.length === 0) {
        return environment === 'prod' ? '1.0.0' : '1.0.0-dev.0';
      }
      
      // Sort by version and get latest
      envReleases.sort((a, b) => this.compareVersions(b.version, a.version));
      return envReleases[0].version;
      
    } catch (error) {
      console.error('Error getting current version:', error);
      return environment === 'prod' ? '1.0.0' : '1.0.0-dev.0';
    }
  }
  
  static async calculateNextVersion(environment, changeTypes) {
    const currentVersion = await this.getCurrentVersion(environment);
    
    if (environment === 'dev') {
      return this.calculateDevVersion(currentVersion, changeTypes);
    } else {
      return this.calculateProdVersion(currentVersion, changeTypes);
    }
  }
  
  static calculateDevVersion(currentVersion, changeTypes) {
    // Dev versions: 5.0.0-dev.1, 5.0.0-dev.2, etc.
    if (currentVersion.includes('-dev.')) {
      const [baseVersion, devPart] = currentVersion.split('-dev.');
      const devNumber = parseInt(devPart) + 1;
      return `${baseVersion}-dev.${devNumber}`;
    } else {
      // First dev version after prod release
      const nextBase = this.incrementVersion(currentVersion, changeTypes);
      return `${nextBase}-dev.1`;
    }
  }
  
  static calculateProdVersion(currentVersion, changeTypes) {
    // Remove -dev suffix if present
    const baseVersion = currentVersion.split('-dev.')[0];
    return this.incrementVersion(baseVersion, changeTypes);
  }
  
  static incrementVersion(version, changeTypes) {
    const [major, minor, patch] = version.split('.').map(Number);
    
    if (changeTypes.breaking) {
      return `${major + 1}.0.0`;
    } else if (changeTypes.features) {
      return `${major}.${minor + 1}.0`;
    } else if (changeTypes.fixes) {
      return `${major}.${minor}.${patch + 1}`;
    }
    
    // Default to patch increment
    return `${major}.${minor}.${patch + 1}`;
  }
  
  static compareVersions(a, b) {
    const parseVersion = (v) => {
      const [base, dev] = v.split('-dev.');
      const [major, minor, patch] = base.split('.').map(Number);
      return { major, minor, patch, dev: dev ? parseInt(dev) : null };
    };
    
    const vA = parseVersion(a);
    const vB = parseVersion(b);
    
    if (vA.major !== vB.major) return vA.major - vB.major;
    if (vA.minor !== vB.minor) return vA.minor - vB.minor;
    if (vA.patch !== vB.patch) return vA.patch - vB.patch;
    
    // Handle dev versions
    if (vA.dev === null && vB.dev === null) return 0;
    if (vA.dev === null) return 1; // prod > dev
    if (vB.dev === null) return -1; // dev < prod
    
    return vA.dev - vB.dev;
  }
  
  static determineReleaseType(changeTypes) {
    if (changeTypes.breaking) return 'Major Release';
    if (changeTypes.features) return 'Feature Release';
    if (changeTypes.fixes) return 'Bug Fix Release';
    return 'Maintenance Release';
  }
  
  static validateVersionIncrement(currentVersion, nextVersion, changeTypes) {
    const current = this.parseVersion(currentVersion);
    const next = this.parseVersion(nextVersion);
    
    // Special handling for dev versions
    if (current.dev !== null || next.dev !== null) {
      // Dev versions can increment dev number regardless of change type
      if (current.dev !== null && next.dev !== null) {
        // Both are dev versions - dev number should increment
        if (next.dev <= current.dev) {
          return {
            valid: false,
            error: `Dev version should increment: ${currentVersion} -> ${currentVersion.split('-dev.')[0]}-dev.${current.dev + 1}`
          };
        }
      }
      return { valid: true }; // Dev versions are more flexible
    }
    
    // Validate increment follows SemVer rules for production versions
    if (changeTypes.breaking) {
      // Major version should increment, minor and patch reset to 0
      if (next.major !== current.major + 1 || next.minor !== 0 || next.patch !== 0) {
        return {
          valid: false,
          error: `Breaking changes require major version increment: ${currentVersion} -> ${next.major}.0.0`
        };
      }
    } else if (changeTypes.features) {
      // Minor version should increment, patch reset to 0, major unchanged
      if (next.major !== current.major || next.minor !== current.minor + 1 || next.patch !== 0) {
        return {
          valid: false,
          error: `Feature changes require minor version increment: ${currentVersion} -> ${current.major}.${current.minor + 1}.0`
        };
      }
    } else if (changeTypes.fixes) {
      // Patch version should increment, major and minor unchanged
      if (next.major !== current.major || next.minor !== current.minor || next.patch !== current.patch + 1) {
        return {
          valid: false,
          error: `Bug fixes require patch version increment: ${currentVersion} -> ${current.major}.${current.minor}.${current.patch + 1}`
        };
      }
    }
    
    return { valid: true };
  }
  
  static parseVersion(version) {
    const [base, dev] = version.split('-dev.');
    const [major, minor, patch] = base.split('.').map(Number);
    return { major, minor, patch, dev: dev ? parseInt(dev) : null };
  }
}