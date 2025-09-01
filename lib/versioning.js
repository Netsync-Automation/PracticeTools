import { db } from './database.js';
import { execSync } from 'child_process';
import fs from 'fs';

export class VersioningSystem {
  static async getCurrentVersion() {
    try {
      const releases = await db.getReleases();
      if (releases.length === 0) {
        return '1.0.0';
      }
      
      const sortedReleases = releases.sort((a, b) => {
        const aVersion = a.version.split('.').map(Number);
        const bVersion = b.version.split('.').map(Number);
        
        for (let i = 0; i < 3; i++) {
          if (aVersion[i] !== bVersion[i]) {
            return bVersion[i] - aVersion[i];
          }
        }
        return 0;
      });
      
      return sortedReleases[0].version;
    } catch (error) {
      console.error('Error getting current version:', error);
      return '1.0.0';
    }
  }

  static parseVersion(version) {
    const parts = version.split('.').map(Number);
    return {
      major: parts[0] || 0,
      minor: parts[1] || 0,
      patch: parts[2] || 0
    };
  }

  static incrementVersion(currentVersion, type = 'patch') {
    const { major, minor, patch } = this.parseVersion(currentVersion);
    
    switch (type) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
      default:
        return `${major}.${minor}.${patch + 1}`;
    }
  }

  static async createRelease(changes, type = 'patch') {
    try {
      const currentVersion = await this.getCurrentVersion();
      const newVersion = this.incrementVersion(currentVersion, type);
      
      const release = {
        version: newVersion,
        date: new Date().toISOString().split('T')[0],
        type: type === 'major' ? 'Major Release' : type === 'minor' ? 'Minor Release' : 'Patch Release',
        features: changes.features || [],
        improvements: changes.improvements || [],
        bugFixes: changes.bugFixes || [],
        breaking: changes.breaking || [],
        notes: changes.notes || ''
      };
      
      const saved = await db.saveRelease(release);
      if (saved) {
        console.log(`✅ Release ${newVersion} created successfully`);
        return { success: true, version: newVersion, release };
      } else {
        console.error('❌ Failed to save release to database');
        return { success: false, error: 'Failed to save release' };
      }
    } catch (error) {
      console.error('Error creating release:', error);
      return { success: false, error: error.message };
    }
  }

  static async getChangesSinceLastCommit() {
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      const diff = execSync('git diff --cached --name-only', { encoding: 'utf8' });
      
      const changes = {
        modified: [],
        added: [],
        deleted: []
      };
      
      status.split('\n').forEach(line => {
        if (line.trim()) {
          const status = line.substring(0, 2);
          const file = line.substring(3);
          
          if (status.includes('M')) changes.modified.push(file);
          if (status.includes('A')) changes.added.push(file);
          if (status.includes('D')) changes.deleted.push(file);
        }
      });
      
      return changes;
    } catch (error) {
      console.error('Error getting git changes:', error);
      return { modified: [], added: [], deleted: [] };
    }
  }
}