import { db } from './dynamodb.js';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export class FeatureVersioning {
  static async initializeBaseline() {
    try {
      const environment = process.env.ENVIRONMENT || 'prod';
      console.log(`🔄 Initializing feature baseline for ${environment} environment...`);
      
      const inventoryPath = join(process.cwd(), 'FEATURE_INVENTORY.md');
      const inventory = readFileSync(inventoryPath, 'utf8');
      
      // Parse existing features from inventory
      const features = this.parseFeatureInventory(inventory);
      
      // Check if baseline already exists
      const existingFeatures = await db.getAllFeatures();
      if (existingFeatures && existingFeatures.length > 0) {
        console.log(`📋 Feature baseline already exists for ${environment}`);
        return existingFeatures;
      }
      
      // Create baseline version 1.0.0
      const baselineVersion = '1.0.0';
      const timestamp = new Date().toISOString();
      
      for (const feature of features) {
        await db.saveFeature({
          id: this.generateFeatureId(feature.name),
          name: feature.name,
          description: feature.description,
          category: feature.category,
          version: baselineVersion,
          changeType: 'baseline',
          dateAdded: timestamp,
          status: 'active'
        });
      }
      
      console.log(`✅ Baseline created with ${features.length} features at version ${baselineVersion}`);
      return features;
    } catch (error) {
      console.error('❌ Error initializing baseline:', error);
      throw error;
    }
  }

  static parseFeatureInventory(inventory) {
    const features = [];
    const lines = inventory.split('\n');
    let currentCategory = '';
    
    for (const line of lines) {
      if (line.startsWith('### ')) {
        currentCategory = line.replace('### ', '').trim();
      } else if (line.startsWith('- **') && line.includes('**:')) {
        const match = line.match(/- \*\*(.+?)\*\*: (.+)/);
        if (match) {
          features.push({
            name: match[1],
            description: match[2],
            category: currentCategory
          });
        }
      }
    }
    
    return features;
  }

  static generateFeatureId(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  }

  static async detectChanges() {
    try {
      const inventoryPath = join(process.cwd(), 'FEATURE_INVENTORY.md');
      const inventory = readFileSync(inventoryPath, 'utf8');
      const currentFeatures = this.parseFeatureInventory(inventory);
      const existingFeatures = await db.getAllFeatures();
      
      const changes = {
        added: [],
        modified: [],
        removed: []
      };
      
      // Find new and modified features
      for (const current of currentFeatures) {
        const existing = existingFeatures.find(f => f.name === current.name);
        if (!existing) {
          changes.added.push(current);
        } else if (existing.description !== current.description) {
          changes.modified.push({ ...current, previousDescription: existing.description });
        }
      }
      
      // Find removed features
      for (const existing of existingFeatures) {
        if (existing.status === 'active' && !currentFeatures.find(f => f.name === existing.name)) {
          changes.removed.push(existing);
        }
      }
      
      return changes;
    } catch (error) {
      console.error('❌ Error detecting changes:', error);
      throw error;
    }
  }

  static determineVersionType(changes) {
    // Breaking changes or removed features = major
    if (changes.removed.length > 0) return 'major';
    
    // New features = minor
    if (changes.added.length > 0) return 'minor';
    
    // Only modifications = patch
    if (changes.modified.length > 0) return 'patch';
    
    return null; // No changes
  }

  static async getCurrentVersion() {
    try {
      const releases = await db.getReleases();
      if (!releases || releases.length === 0) return '1.0.0';
      
      return releases.sort((a, b) => {
        const parseVersion = (version) => {
          const parts = version.split('.').map(Number);
          return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 };
        };
        
        const vA = parseVersion(a.version);
        const vB = parseVersion(b.version);
        
        if (vB.major !== vA.major) return vB.major - vA.major;
        if (vB.minor !== vA.minor) return vB.minor - vA.minor;
        return vB.patch - vA.patch;
      })[0].version;
    } catch (error) {
      console.error('Error getting current version:', error);
      return '1.0.0';
    }
  }

  static incrementVersion(currentVersion, type) {
    const [major, minor, patch] = currentVersion.split('.').map(Number);
    
    switch (type) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
        return `${major}.${minor}.${patch + 1}`;
      default:
        return currentVersion;
    }
  }

  static generateReleaseNotes(version, changes) {
    const notes = [];
    
    if (changes.added.length > 0) {
      notes.push('## 🆕 New Features');
      changes.added.forEach(feature => {
        notes.push(`- **${feature.name}**: ${feature.description}`);
      });
      notes.push('');
    }
    
    if (changes.modified.length > 0) {
      notes.push('## 🔧 Improvements');
      changes.modified.forEach(feature => {
        notes.push(`- **${feature.name}**: Enhanced functionality - ${feature.description}`);
      });
      notes.push('');
    }
    
    if (changes.removed.length > 0) {
      notes.push('## ⚠️ Breaking Changes');
      changes.removed.forEach(feature => {
        notes.push(`- **${feature.name}**: Feature removed or significantly changed`);
      });
      notes.push('');
    }
    
    return notes.join('\n');
  }

  static generateHelpContent(features) {
    const helpSections = new Map();
    
    features.forEach(feature => {
      if (!helpSections.has(feature.category)) {
        helpSections.set(feature.category, []);
      }
      helpSections.get(feature.category).push(feature);
    });
    
    const helpContent = [];
    
    helpSections.forEach((features, category) => {
      helpContent.push(`## ${category}`);
      helpContent.push('');
      
      features.forEach(feature => {
        helpContent.push(`### ${feature.name}`);
        helpContent.push(feature.description);
        helpContent.push('');
      });
    });
    
    return helpContent.join('\n');
  }

  static async processDeployment() {
    try {
      const environment = process.env.ENVIRONMENT || 'prod';
      console.log(`\n🚀 === PROCESSING POST-DEPLOYMENT VERSIONING (${environment.toUpperCase()}) ===`);
      console.log('📅 Start time:', new Date().toISOString());
      console.log('📁 Working directory:', process.cwd());
      console.log('🌍 Environment:', environment);
      console.log('📊 Database tables:', `PracticeTools-${environment}-*`);
      
      // Initialize baseline if needed
      console.log('\n🔄 Initializing baseline...');
      await this.initializeBaseline();
      console.log('✅ Baseline initialization complete');
      
      // Detect changes
      console.log('\n🔍 Detecting feature changes...');
      const changes = await this.detectChanges();
      console.log('📊 Changes detected:', JSON.stringify({
        added: changes.added.length,
        modified: changes.modified.length,
        removed: changes.removed.length
      }, null, 2));
      
      const versionType = this.determineVersionType(changes);
      console.log('🎯 Version type determined:', versionType);
      
      if (!versionType) {
        console.log('📋 No feature changes detected - no version update needed');
        return { success: true, message: 'No changes detected' };
      }
      console.log('✅ Changes detected, proceeding with version creation...');
      
      // Create new version
      console.log('\n📊 Getting current version...');
      const currentVersion = await this.getCurrentVersion();
      console.log('📊 Current version:', currentVersion);
      
      const newVersion = this.incrementVersion(currentVersion, versionType);
      console.log('🎯 New version:', newVersion);
      
      const timestamp = new Date().toISOString();
      console.log('📅 Timestamp:', timestamp);
      
      // Save feature changes
      console.log('\n💾 Saving feature changes to database...');
      for (const feature of changes.added) {
        await db.saveFeature({
          id: this.generateFeatureId(feature.name),
          name: feature.name,
          description: feature.description,
          category: feature.category,
          version: newVersion,
          changeType: 'added',
          dateAdded: timestamp,
          status: 'active'
        });
      }
      
      for (const feature of changes.modified) {
        await db.updateFeature(this.generateFeatureId(feature.name), {
          description: feature.description,
          version: newVersion,
          changeType: 'modified',
          dateModified: timestamp
        });
      }
      
      for (const feature of changes.removed) {
        await db.updateFeature(this.generateFeatureId(feature.name), {
          status: 'removed',
          version: newVersion,
          changeType: 'removed',
          dateRemoved: timestamp
        });
      }
      
      // Generate release notes
      const releaseNotes = this.generateReleaseNotes(newVersion, changes);
      
      // Generate help content
      const allFeatures = await db.getAllFeatures();
      const activeFeatures = allFeatures.filter(f => f.status === 'active');
      const helpContent = this.generateHelpContent(activeFeatures);
      
      // Save release
      console.log('\n📦 Creating release object...');
      const release = {
        version: newVersion,
        date: new Date().toISOString().split('T')[0],
        type: versionType === 'major' ? 'Major Release' : 
              versionType === 'minor' ? 'Minor Release' : 'Patch Release',
        notes: releaseNotes,
        helpContent: helpContent,
        changes: {
          added: changes.added.length,
          modified: changes.modified.length,
          removed: changes.removed.length
        }
      };
      console.log('📦 Release object created:', JSON.stringify(release, null, 2));
      
      console.log('\n💾 Saving release to database...');
      const saveResult = await db.saveRelease(release);
      console.log('💾 Save result:', saveResult);
      
      // Update UI components
      await this.updateVersionInFiles(newVersion);
      
      // Update help content based on new features
      try {
        const { HelpGenerator } = await import('./help-generator.js');
        await HelpGenerator.updateHelpContent();
        console.log('✅ Help content updated with latest features');
      } catch (helpError) {
        console.error('⚠️ Help content update failed:', helpError);
      }
      
      console.log(`\n✅ === VERSION ${newVersion} CREATED SUCCESSFULLY ===`);
      console.log(`📋 Changes: ${changes.added.length} added, ${changes.modified.length} modified, ${changes.removed.length} removed`);
      console.log('📅 Completion time:', new Date().toISOString());
      
      return { success: true, newVersion, release };
    } catch (error) {
      console.error('\n💥 === DEPLOYMENT PROCESSING ERROR ===');
      console.error('❌ Error message:', error.message);
      console.error('📍 Error stack:', error.stack);
      console.error('📅 Error time:', new Date().toISOString());
      return { success: false, error: error.message };
    }
  }

  static async updateVersionInFiles(version) {
    try {
      // Update feature inventory
      const inventoryPath = join(process.cwd(), 'FEATURE_INVENTORY.md');
      let inventory = readFileSync(inventoryPath, 'utf8');
      
      const today = new Date().toISOString().split('T')[0];
      inventory = inventory.replace(/\*\*Version:\*\* .+/, `**Version:** ${version}`);
      inventory = inventory.replace(/\*\*Last Updated:\*\* .+/, `**Last Updated:** ${today}`);
      
      writeFileSync(inventoryPath, inventory, 'utf8');
      
      // Update version in database for UI components
      await db.saveSetting('current_version', version);
      
      console.log(`✅ Version ${version} updated in files and database`);
    } catch (error) {
      console.error('❌ Error updating version in files:', error);
      throw error;
    }
  }
}