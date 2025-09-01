import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const CHANGES_FILE = './pending-changes.json';

export class ChangeTracker {
  static loadChanges() {
    if (!existsSync(CHANGES_FILE)) {
      return { features: [], fixes: [], breaking: [], other: [] };
    }
    return JSON.parse(readFileSync(CHANGES_FILE, 'utf8'));
  }

  static saveChanges(changes) {
    writeFileSync(CHANGES_FILE, JSON.stringify(changes, null, 2));
  }

  static addChange(type, description, details = {}) {
    const changes = this.loadChanges();
    const change = {
      id: Date.now(),
      description,
      details,
      timestamp: new Date().toISOString(),
      files: this.getModifiedFiles()
    };

    changes[type].push(change);
    this.saveChanges(changes);
    console.log(`✅ Tracked ${type}: ${description}`);
  }

  static getModifiedFiles() {
    try {
      const output = execSync('git diff --name-only HEAD', { encoding: 'utf8' });
      return output.trim().split('\n').filter(f => f);
    } catch {
      return [];
    }
  }

  static analyzeChanges() {
    const changes = this.loadChanges();
    const modifiedFiles = this.getModifiedFiles();
    
    // Auto-detect change types based on file patterns
    const autoDetected = [];
    
    modifiedFiles.forEach(file => {
      if (file.includes('/api/') && !changes.features.some(c => c.files.includes(file))) {
        autoDetected.push({
          type: 'features',
          description: `Enhanced API endpoint: ${file.split('/').pop().replace('.js', '')}`,
          file
        });
      }
      
      if (file.includes('components/') && !changes.features.some(c => c.files.includes(file))) {
        autoDetected.push({
          type: 'features', 
          description: `Updated UI component: ${file.split('/').pop().replace('.js', '')}`,
          file
        });
      }
      
      if (file.includes('page.js') && !changes.features.some(c => c.files.includes(file))) {
        autoDetected.push({
          type: 'features',
          description: `Enhanced page: ${file.split('/').slice(-2, -1)[0]}`,
          file
        });
      }
    });

    return { tracked: changes, autoDetected };
  }

  static clearChanges() {
    writeFileSync(CHANGES_FILE, JSON.stringify({ features: [], fixes: [], breaking: [], other: [] }, null, 2));
  }
}