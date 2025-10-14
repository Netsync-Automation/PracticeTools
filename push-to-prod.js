#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import readline from 'readline';
import { config } from 'dotenv';
import { DynamoDBClient, CreateTableCommand, DescribeTableCommand, ScanCommand, ListTablesCommand, PutItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { db } from './lib/dynamodb.js';

// Load environment variables from .env.local
config({ path: '.env.local' });

// DynamoDB client will be created after region confirmation
let dynamoClient = null;

function createDynamoClient(region) {
  if (!dynamoClient) {
    dynamoClient = new DynamoDBClient({
      region: region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });
  }
  return dynamoClient;
}

class ProdPushManager {
  static appName = null;
  static awsRegion = null;
  static backupDir = null;
  
  static async getApplicationName() {
    if (this.appName) return this.appName;
    
    // Get default from current directory name
    const defaultName = basename(process.cwd());
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      rl.question(`\n📦 Application Name [${defaultName}]: `, (answer) => {
        rl.close();
        const appName = answer.trim() || defaultName;
        this.appName = appName;
        console.log(`✅ Using application name: ${appName}`);
        resolve(appName);
      });
    });
  }
  
  static async getAwsRegion() {
    if (this.awsRegion) return this.awsRegion;
    
    // Get default from environment or hardcoded fallback
    const defaultRegion = process.env.AWS_DEFAULT_REGION || 'us-east-1';
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      rl.question(`\n🌍 AWS Region [${defaultRegion}]: `, (answer) => {
        rl.close();
        const region = answer.trim() || defaultRegion;
        this.awsRegion = region;
        console.log(`✅ Using AWS region: ${region}`);
        resolve(region);
      });
    });
  }
  
  static async getBackupDirectory() {
    if (this.backupDir) return this.backupDir;
    
    const defaultDir = 'D:\\Coding\\Backups\\PracticeTools\\prod';
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      rl.question(`\n💾 Production Backup Directory [${defaultDir}]: `, (answer) => {
        rl.close();
        const backupDir = answer.trim() || defaultDir;
        this.backupDir = backupDir;
        console.log(`✅ Using backup directory: ${backupDir}`);
        resolve(backupDir);
      });
    });
  }
  
  static async analyzeDiff() {
    try {
      // Fetch all branches first
      execSync('git fetch origin', { stdio: 'pipe' });
      
      // Verify main branch exists
      try {
        execSync('git show-ref --verify --quiet refs/remotes/origin/main', { stdio: 'pipe' });
      } catch (error) {
        throw new Error('Main branch does not exist. Please create the main branch manually before running this script.');
      }
      
      // Get diff between dev and main branches (use two-dot syntax for unrelated histories)
      const diff = execSync('git diff origin/main..origin/dev --name-only', { encoding: 'utf8' });
      const changedFiles = diff.split('\n').filter(line => line.trim());
      
      const changes = {
        breaking: [],
        features: [],
        fixes: []
      };
      
      // Analyze each changed file
      for (const file of changedFiles) {
        if (!file) continue;
        
        try {
          const fileDiff = execSync(`git diff origin/main..origin/dev -- "${file}"`, { encoding: 'utf8' });
          const change = this.categorizeChange(file, fileDiff);
          if (change) {
            changes[change.type].push(change);
          }
        } catch (error) {
          console.log(`Warning: Could not analyze ${file}`);
        }
      }
      
      return changes;
    } catch (error) {
      throw new Error(`Failed to analyze git diff: ${error.message}`);
    }
  }
  
  static categorizeChange(file, diff) {
    const addedLines = diff.split('\n').filter(line => line.startsWith('+')).length;
    const removedLines = diff.split('\n').filter(line => line.startsWith('-')).length;
    
    // Breaking changes detection
    if (diff.includes('BREAKING CHANGE') || 
        diff.includes('breaking:') ||
        (file.includes('api/') && removedLines > addedLines * 2)) {
      return {
        type: 'breaking',
        file,
        description: this.generateDescription(file, diff, 'breaking')
      };
    }
    
    // Feature detection
    if (file.includes('page.js') && addedLines > 20 ||
        file.includes('components/') && addedLines > 10 ||
        diff.includes('feat:') ||
        diff.includes('add') ||
        diff.includes('new')) {
      return {
        type: 'features',
        file,
        description: this.generateDescription(file, diff, 'feature')
      };
    }
    
    // Bug fix detection (default)
    return {
      type: 'fixes',
      file,
      description: this.generateDescription(file, diff, 'fix')
    };
  }
  
  static generateDescription(file, diff, type) {
    const fileName = file.split('/').pop();
    const addedLines = diff.split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++'));
    const removedLines = diff.split('\n').filter(line => line.startsWith('-') && !line.startsWith('---'));
    
    // Extract specific function/method names that were added or modified
    const addedFunctions = addedLines.join(' ').match(/function\s+(\w+)|const\s+(\w+)\s*=|async\s+(\w+)|export\s+.*?(\w+)/g) || [];
    const addedClasses = addedLines.join(' ').match(/class\s+(\w+)|className[=:]\s*["']([^"']+)["']/g) || [];
    const addedImports = addedLines.filter(line => line.includes('import')).map(line => {
      const match = line.match(/import.*?from\s+["']([^"']+)["']/);
      return match ? match[1] : null;
    }).filter(Boolean);
    
    // Look for specific code patterns
    const codeChanges = [];
    
    // Database operations
    if (addedLines.some(line => line.includes('CreateTableCommand'))) {
      codeChanges.push('Added DynamoDB table creation functionality');
    }
    if (addedLines.some(line => line.includes('GetParameterCommand'))) {
      codeChanges.push('Added SSM parameter retrieval functionality');
    }
    if (addedLines.some(line => line.includes('saveRelease'))) {
      codeChanges.push('Added release data persistence to database');
    }
    
    // Authentication changes
    if (addedLines.some(line => line.includes('SAML') || line.includes('saml'))) {
      if (addedLines.some(line => line.includes('metadata'))) {
        codeChanges.push('Added SAML metadata parsing for SSO configuration');
      }
      if (addedLines.some(line => line.includes('login'))) {
        codeChanges.push('Added SAML login URL generation');
      }
    }
    
    // UI/Component changes
    if (addedLines.some(line => line.includes('SidebarLayout'))) {
      codeChanges.push('Added sidebar navigation layout component');
    }
    if (addedLines.some(line => line.includes('breadcrumb') && line.includes('Home'))) {
      codeChanges.push('Fixed duplicate Home links in breadcrumb navigation');
    }
    
    // API changes
    if (file.includes('api/') && addedLines.some(line => line.includes('export async function'))) {
      const methods = addedLines.filter(line => line.includes('export async function')).map(line => {
        const match = line.match(/export async function (\w+)/);
        return match ? match[1] : null;
      }).filter(Boolean);
      if (methods.length > 0) {
        codeChanges.push(`Added ${methods.join(', ')} API endpoint${methods.length > 1 ? 's' : ''}`);
      }
    }
    
    // Configuration changes
    if (fileName.includes('.yaml') && addedLines.some(line => line.includes('secrets:'))) {
      codeChanges.push('Added secure environment variable configuration');
    }
    
    // Script changes
    if (fileName.includes('package.json') && addedLines.some(line => line.includes('"push-to-prod"'))) {
      codeChanges.push('Added production deployment script');
    }
    
    // Version management
    if (addedLines.some(line => line.includes('calculateNextVersion'))) {
      codeChanges.push('Added semantic version calculation logic');
    }
    
    // Error handling
    if (addedLines.some(line => line.includes('try {') || line.includes('catch'))) {
      codeChanges.push('Added error handling and validation');
    }
    
    // Return specific changes or fallback
    if (codeChanges.length > 0) {
      return codeChanges[0]; // Return the most specific change found
    }
    
    // If no specific changes detected, create a basic description
    const cleanName = fileName.replace('.js', '').replace(/([A-Z])/g, ' $1').trim();
    if (addedLines.length > 10) {
      return `Added new ${cleanName} functionality`;
    } else if (removedLines.length > addedLines.length) {
      return `Refactored ${cleanName} code`;
    } else {
      return `Updated ${cleanName}`;
    }
  }
  
  static async getCurrentProdVersion() {
    try {
      console.log('Checking current production version...');
      
      // Try to get current version from production settings first
      try {
        const getCommand = new GetItemCommand({
          TableName: `${this.appName}-prod-Settings`,
          Key: { setting_key: { S: 'current_version' } }
        });
        
        const result = await createDynamoClient(this.awsRegion).send(getCommand);
        if (result.Item && result.Item.setting_value) {
          const currentVersion = result.Item.setting_value.S;
          console.log(`Current production version from settings: ${currentVersion}`);
          return currentVersion;
        }
      } catch (settingsError) {
        console.log('Settings table not available, checking releases table...');
      }
      
      // Fallback to scanning releases table
      const scanCommand = new ScanCommand({
        TableName: `${this.appName}-prod-Releases`
      });
      
      const scanResult = await createDynamoClient(this.awsRegion).send(scanCommand);
      const releases = (scanResult.Items || []).map(item => ({
        version: item.version?.S || '',
        date: item.date?.S || ''
      }));
      
      console.log(`Found ${releases.length} production releases`);
      
      if (releases.length === 0) {
        return null;
      }
      
      // Sort by version and get latest
      const sortedReleases = releases.sort((a, b) => {
        const aVersion = a.version.replace('v', '').split('.').map(Number);
        const bVersion = b.version.replace('v', '').split('.').map(Number);
        
        for (let i = 0; i < 3; i++) {
          if (aVersion[i] !== bVersion[i]) {
            return bVersion[i] - aVersion[i];
          }
        }
        return 0;
      });
      
      console.log(`Latest production version from releases: ${sortedReleases[0].version}`);
      return sortedReleases[0].version;
    } catch (error) {
      console.log('Error getting production version:', error.message);
      return null;
    }
  }
  
  static calculateNextVersion(currentVersion, changes) {
    if (!currentVersion) {
      // First version is always v1.0.0
      return 'v1.0.0';
    }
    
    // Remove any existing 'v' prefix to avoid double prefixes
    const cleanVersion = currentVersion.replace(/^v+/, '');
    const parts = cleanVersion.split('.').map(Number);
    let major = parts[0] || 1;
    let minor = parts[1] || 0;
    let patch = parts[2] || 0;
    
    if (changes.breaking.length > 0) {
      major++;
      minor = 0;
      patch = 0;
    } else if (changes.features.length > 0) {
      minor++;
      patch = 0;
    } else {
      patch++;
    }
    
    return `v${major}.${minor}.${patch}`;
  }
  
  static generateReleaseNotes(changes, version) {
    const date = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // Group and deduplicate descriptions
    const groupedChanges = {
      breaking: this.groupDescriptions(changes.breaking),
      features: this.groupDescriptions(changes.features),
      fixes: this.groupDescriptions(changes.fixes)
    };
    
    let notes = `# 🎉 Version ${version}\n\n`;
    
    if (groupedChanges.breaking.length > 0) {
      notes += `## 🚨 Breaking Changes\n\n`;
      groupedChanges.breaking.forEach(desc => {
        notes += `- ${desc}\n`;
      });
      notes += '\n';
    }
    
    if (groupedChanges.features.length > 0) {
      notes += `## ✨ New Features\n\n`;
      groupedChanges.features.forEach(desc => {
        notes += `- ${desc}\n`;
      });
      notes += '\n';
    }
    
    if (groupedChanges.fixes.length > 0) {
      notes += `## 🐛 Bug Fixes\n\n`;
      groupedChanges.fixes.forEach(desc => {
        notes += `- ${desc}\n`;
      });
      notes += '\n';
    }
    
    notes += `---\n\n**📅 Released:** ${date}\n**📦 Version:** ${version}\n\n*Production Release*`;
    
    return notes;
  }
  
  static groupDescriptions(changes) {
    const descriptions = changes.map(c => c.description);
    const grouped = new Map();
    const fileGroups = new Map();
    
    descriptions.forEach((desc, index) => {
      const file = changes[index].file;
      
      // Group by description pattern, but keep all unique changes
      if (desc.includes('Added error handling')) {
        const existing = grouped.get('error-handling') || [];
        existing.push(`Enhanced error handling in ${this.getFileContext(file)}`);
        grouped.set('error-handling', existing);
      } else if (desc.includes('Added SSM parameter')) {
        const existing = grouped.get('ssm-params') || [];
        existing.push(`Added SSM parameter support in ${this.getFileContext(file)}`);
        grouped.set('ssm-params', existing);
      } else if (desc.includes('Added SAML')) {
        const existing = grouped.get('saml-auth') || [];
        existing.push(`${desc} in ${this.getFileContext(file)}`);
        grouped.set('saml-auth', existing);
      } else if (desc.includes('Added sidebar navigation')) {
        const existing = grouped.get('sidebar') || [];
        existing.push(`Added sidebar navigation to ${this.getFileContext(file)}`);
        grouped.set('sidebar', existing);
      } else if (desc.includes('API endpoint')) {
        const existing = grouped.get('api-endpoints') || [];
        existing.push(`${desc} (${this.getFileContext(file)})`);
        grouped.set('api-endpoints', existing);
      } else if (desc.includes('Added DynamoDB')) {
        const existing = grouped.get('database') || [];
        existing.push(`${desc} in ${this.getFileContext(file)}`);
        grouped.set('database', existing);
      } else {
        // Keep all other unique descriptions
        grouped.set(desc + '-' + index, desc);
      }
    });
    
    // Flatten grouped items
    const result = [];
    grouped.forEach((items, key) => {
      if (Array.isArray(items)) {
        // For grouped items, show summary + count if more than 3
        if (items.length <= 3) {
          result.push(...items);
        } else {
          result.push(`${items[0]} and ${items.length - 1} other components`);
        }
      } else {
        result.push(items);
      }
    });
    
    return result;
  }
  
  static getFileContext(file) {
    if (file.includes('api/')) {
      return file.split('/').slice(-2, -1)[0] + ' API';
    }
    if (file.includes('components/')) {
      return file.split('/').pop().replace('.js', '') + ' component';
    }
    if (file.includes('page.js')) {
      return file.split('/').slice(-2, -1)[0] + ' page';
    }
    if (file.includes('lib/')) {
      return file.split('/').pop().replace('.js', '') + ' library';
    }
    return file.split('/').pop().replace('.js', '');
  }
  
  static async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
    const backupPath = join(this.backupDir, this.appName, timestamp);
    
    // Create backup directory
    mkdirSync(backupPath, { recursive: true });
    
    console.log(`📁 Creating backup at: ${backupPath}`);
    
    let hasMainBranch = false;
    let backedUpTables = [];
    
    // 1. Backup main branch code
    console.log('💾 Backing up main branch code...');
    try {
      execSync('git fetch origin', { stdio: 'pipe' });
      execSync(`git archive origin/main | tar -x -C "${backupPath}"`, { stdio: 'pipe' });
      hasMainBranch = true;
      console.log('   ✅ Main branch code backed up');
    } catch (error) {
      console.log('   ⚠️  No main branch found - continuing without code backup');
    }
    
    // 2. Discover and backup all production tables
    console.log('💾 Discovering production database tables...');
    try {
      const listCommand = new ListTablesCommand({});
      const result = await createDynamoClient(this.awsRegion).send(listCommand);
      const allTables = result.TableNames || [];
      
      // Filter for prod tables
      const prodTables = allTables.filter(tableName => 
        tableName.startsWith(`${this.appName}-prod`)
      );
      
      if (prodTables.length === 0) {
        console.log('   ⚠️  No production tables found - continuing without database backup');
      } else {
        console.log(`   Found ${prodTables.length} production tables`);
        
        for (const tableName of prodTables) {
          try {
            console.log(`   Backing up ${tableName}...`);
            const scanCommand = new ScanCommand({ TableName: tableName });
            const scanResult = await createDynamoClient(this.awsRegion).send(scanCommand);
            
            const backupData = {
              tableName: tableName,
              items: scanResult.Items || [],
              count: scanResult.Count || 0,
              backupTimestamp: new Date().toISOString()
            };
            
            const fileName = tableName.replace(`${this.appName}-prod-`, '') + '-backup.json';
            writeFileSync(
              join(backupPath, fileName),
              JSON.stringify(backupData, null, 2)
            );
            
            backedUpTables.push(tableName);
            console.log(`   ✅ ${tableName} backed up (${backupData.count} items)`);
          } catch (error) {
            console.log(`   ⚠️  Failed to backup ${tableName}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Failed to list tables: ${error.message}`);
    }
    
    // 3. Create backup manifest
    const manifest = {
      backupTimestamp: new Date().toISOString(),
      appName: this.appName,
      environment: 'prod',
      gitBranch: hasMainBranch ? 'main' : 'none',
      tables: backedUpTables,
      backupPath: backupPath,
      status: {
        codeBackup: hasMainBranch,
        databaseBackup: backedUpTables.length > 0,
        totalTables: backedUpTables.length
      }
    };
    
    writeFileSync(
      join(backupPath, 'backup-manifest.json'),
      JSON.stringify(manifest, null, 2)
    );
    
    // 4. Create README with restore instructions
    const readmeContent = this.generateBackupReadme(manifest);
    writeFileSync(join(backupPath, 'README.md'), readmeContent);
    
    // Status summary
    if (!hasMainBranch && backedUpTables.length === 0) {
      console.log('⚠️  No existing data found to backup (empty main branch and no prod tables)');
    } else {
      console.log(`✅ Backup completed: ${backupPath}`);
      console.log(`   Code backup: ${hasMainBranch ? 'Yes' : 'No'}`);
      console.log(`   Database backup: ${backedUpTables.length} tables`);
    }
    
    return backupPath;
  }
  
  static generateBackupReadme(manifest) {
    let readme = '# Production Backup - ' + manifest.appName + '\n\n';
    readme += '**Backup Created:** ' + manifest.backupTimestamp + '\n';
    readme += '**Environment:** ' + manifest.environment + '\n';
    readme += '**Git Branch:** ' + manifest.gitBranch + '\n';
    readme += '**Tables Backed Up:** ' + manifest.tables.length + '\n\n';
    
    readme += '## Contents\n\n';
    
    readme += '### Code Backup\n';
    if (manifest.status.codeBackup) {
      readme += '- Complete main branch source code archive\n';
      readme += '- All application files and configurations\n\n';
    } else {
      readme += '- No code backup (main branch not found)\n\n';
    }
    
    readme += '### Database Backup\n';
    if (manifest.status.databaseBackup) {
      manifest.tables.forEach(table => {
        const fileName = table.replace(`${this.appName}-prod-`, '') + '-backup.json';
        readme += '- ' + fileName + '\n';
      });
      readme += '\n';
    } else {
      readme += '- No database backup (no production tables found)\n\n';
    }
    
    readme += '## Restore Instructions\n\n';
    
    readme += '### Code Restore\n';
    if (manifest.status.codeBackup) {
      readme += '1. Extract all files from this backup directory to your project root\n';
      readme += '2. Ensure all dependencies are installed: `npm install`\n';
      readme += '3. Configure environment variables as needed\n\n';
    } else {
      readme += 'No code to restore (backup contains no main branch data)\n\n';
    }
    
    readme += '### Database Restore\n';
    if (manifest.status.databaseBackup) {
      readme += '1. Ensure AWS credentials are configured\n';
      readme += '2. Use AWS CLI or DynamoDB console to restore tables:\n';
      readme += '   ```bash\n';
      readme += '   # For each table backup file:\n';
      readme += '   aws dynamodb batch-write-item --request-items file://[table]-backup.json\n';
      readme += '   ```\n';
      readme += '3. Verify table data after restore\n\n';
    } else {
      readme += 'No database to restore (backup contains no production table data)\n\n';
    }
    
    readme += '### Manual Restore Process\n\n';
    readme += '1. **Backup Current State** (if any exists)\n';
    readme += '   ```bash\n';
    readme += '   # Create a backup of current state before restoring\n';
    readme += '   git branch backup-before-restore\n';
    readme += '   ```\n\n';
    readme += '2. **Restore Code**\n';
    readme += '   ```bash\n';
    readme += '   # Copy all files from backup to project directory\n';
    readme += '   cp -r * /path/to/project/\n';
    readme += '   ```\n\n';
    readme += '3. **Restore Database Tables**\n';
    readme += '   ```bash\n';
    readme += '   # Use the backup JSON files to restore each table\n';
    readme += '   # Modify the JSON format as needed for DynamoDB import\n';
    readme += '   ```\n\n';
    
    readme += '## Backup Verification\n\n';
    readme += '- **Manifest File:** backup-manifest.json contains backup metadata\n';
    readme += '- **File Count:** Verify all expected files are present\n';
    readme += '- **Table Data:** Check JSON files contain expected data structure\n\n';
    
    readme += '## Support\n\n';
    readme += 'If you need assistance with restoration, refer to:\n';
    readme += '- AWS DynamoDB documentation for table restoration\n';
    readme += '- Git documentation for code restoration\n';
    readme += '- Project-specific deployment guides\n\n';
    
    readme += '---\n';
    readme += `*Backup created by ${this.appName} Production Push System*\n`;
    
    return readme;
  }
  
  static async getUserApproval(currentVersion, nextVersion, releaseNotes) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    console.log('\n🔍 PRODUCTION PUSH PREVIEW\n');
    console.log(`📦 Current Production Version: ${currentVersion || 'None'}`);
    console.log(`📦 Next Production Version: ${nextVersion}`);
    console.log('\n📝 RELEASE NOTES PREVIEW:');
    console.log(releaseNotes);
    
    return new Promise((resolve) => {
      rl.question('\n❓ Proceed with production push? (y/N): ', (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }
  
  static async updateProdDatabase(version, releaseNotes, changes) {
    const now = new Date();
    const release = {
      version,
      date: now.toISOString().split('T')[0],
      timestamp: now.toISOString(),
      type: changes.breaking.length > 0 ? 'Major Release' : 
            changes.features.length > 0 ? 'Feature Release' : 'Bug Fix Release',
      notes: releaseNotes,
      features: changes.features.map(f => f.description),
      improvements: [],
      bugFixes: changes.fixes.map(f => f.description),
      breaking: changes.breaking.map(b => b.description)
    };
    
    console.log('Saving release to PRODUCTION database...');
    
    // Save to prod releases table using direct DynamoDB commands
    const releaseCommand = new PutItemCommand({
      TableName: `${this.appName}-prod-Releases`,
      Item: {
        version: { S: release.version },
        date: { S: release.date },
        timestamp: { S: release.timestamp },
        type: { S: release.type },
        features: { S: JSON.stringify(release.features) },
        improvements: { S: JSON.stringify(release.improvements) },
        bugFixes: { S: JSON.stringify(release.bugFixes) },
        breaking: { S: JSON.stringify(release.breaking) },
        notes: { S: release.notes },
        helpContent: { S: '' },
        created_at: { S: now.toISOString() }
      }
    });
    
    await createDynamoClient(this.awsRegion).send(releaseCommand);
    console.log('✅ Release saved to production releases table');
    
    // Update current version setting in prod using dev schema
    const settingCommand = new PutItemCommand({
      TableName: `${this.appName}-prod-Settings`,
      Item: {
        setting_key: { S: 'current_version' },
        setting_value: { S: version },
        updated_at: { S: now.toISOString() }
      }
    });
    
    await createDynamoClient(this.awsRegion).send(settingCommand);
    console.log('✅ Current version setting updated in production');
  }
  
  static async updateReleaseNotesPage(version, releaseNotes) {
    try {
      // The release notes are stored in the database and the page loads them dynamically
      // However, we should ensure the database contains the release notes in the correct format
      console.log('✅ Release notes stored in database - page will load dynamically');
      
      // Verify the release was saved with the notes
      const scanCommand = new ScanCommand({
        TableName: `${this.appName}-prod-Releases`,
        FilterExpression: 'version = :version',
        ExpressionAttributeValues: {
          ':version': { S: version }
        }
      });
      
      const result = await createDynamoClient(this.awsRegion).send(scanCommand);
      if (result.Items && result.Items.length > 0) {
        const savedRelease = result.Items[0];
        const savedNotes = savedRelease.notes?.S || '';
        if (savedNotes.length > 0) {
          console.log(`✅ Release notes verified in database (${savedNotes.length} characters)`);
        } else {
          console.log('⚠️  Warning: Release notes appear to be empty in database');
        }
      } else {
        console.log('⚠️  Warning: Could not verify release in database');
      }
      
    } catch (error) {
      console.log('⚠️  Release notes verification failed:', error.message);
    }
  }
  
  static async ensureProdTables() {
    console.log('   Discovering dev tables to replicate...');
    
    // Discover all dev tables
    const listCommand = new ListTablesCommand({});
    const result = await createDynamoClient(this.awsRegion).send(listCommand);
    const allTables = result.TableNames || [];
    
    // Filter for dev tables
    const devTables = allTables.filter(tableName => 
      tableName.startsWith(`${this.appName}-dev-`)
    );
    
    if (devTables.length === 0) {
      console.log('   ⚠️  No dev tables found - cannot create prod tables');
      return;
    }
    
    console.log(`   Found ${devTables.length} dev tables to replicate`);
    
    for (const devTableName of devTables) {
      try {
        // Get dev table schema
        const describeCommand = new DescribeTableCommand({ TableName: devTableName });
        const devTableInfo = await createDynamoClient(this.awsRegion).send(describeCommand);
        
        // Create corresponding prod table name
        const prodTableName = devTableName.replace(`${this.appName}-dev-`, `${this.appName}-prod-`);
        
        // Check if prod table already exists
        try {
          const existingTable = await createDynamoClient(this.awsRegion).send(new DescribeTableCommand({ TableName: prodTableName }));
          console.log(`   ✅ Table ${prodTableName} already exists`);
          
          // Verify schema matches (optional validation)
          const devKeys = devTableInfo.Table.KeySchema.map(k => `${k.AttributeName}:${k.KeyType}`).sort();
          const prodKeys = existingTable.Table.KeySchema.map(k => `${k.AttributeName}:${k.KeyType}`).sort();
          
          if (JSON.stringify(devKeys) !== JSON.stringify(prodKeys)) {
            console.log(`   ⚠️  SCHEMA MISMATCH: ${prodTableName}`);
            console.log(`      Dev schema:  ${devKeys.join(', ')}`);
            console.log(`      Prod schema: ${prodKeys.join(', ')}`);
            console.log(`      📝 NOTE: Production table uses different schema than dev`);
            console.log(`      ⚠️  Manual intervention may be required for this table`);
          }
          
        } catch (error) {
          if (error.name === 'ResourceNotFoundException') {
            console.log(`   📊 Creating table ${prodTableName}...`);
            
            // Create prod table with exact same schema as dev table
            const createParams = {
              TableName: prodTableName,
              KeySchema: devTableInfo.Table.KeySchema,
              AttributeDefinitions: devTableInfo.Table.AttributeDefinitions,
              BillingMode: 'PAY_PER_REQUEST'
            };
            
            // Add GSI if dev table has them
            if (devTableInfo.Table.GlobalSecondaryIndexes && devTableInfo.Table.GlobalSecondaryIndexes.length > 0) {
              createParams.GlobalSecondaryIndexes = devTableInfo.Table.GlobalSecondaryIndexes.map(gsi => ({
                IndexName: gsi.IndexName,
                KeySchema: gsi.KeySchema,
                Projection: gsi.Projection
              }));
              console.log(`      Including ${devTableInfo.Table.GlobalSecondaryIndexes.length} GSI(s)`);
            }
            
            // Add LSI if dev table has them
            if (devTableInfo.Table.LocalSecondaryIndexes && devTableInfo.Table.LocalSecondaryIndexes.length > 0) {
              createParams.LocalSecondaryIndexes = devTableInfo.Table.LocalSecondaryIndexes.map(lsi => ({
                IndexName: lsi.IndexName,
                KeySchema: lsi.KeySchema,
                Projection: lsi.Projection
              }));
              console.log(`      Including ${devTableInfo.Table.LocalSecondaryIndexes.length} LSI(s)`);
            }
            
            await createDynamoClient(this.awsRegion).send(new CreateTableCommand(createParams));
            console.log(`   ✅ Created table ${prodTableName} (exact schema copy from ${devTableName})`);
            
            // Wait for table to become active
            console.log(`      Waiting for ${prodTableName} to become active...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            
          } else {
            throw error;
          }
        }
      } catch (error) {
        console.log(`   ⚠️  Failed to process ${devTableName}: ${error.message}`);
        // Continue with other tables even if one fails
      }
    }
    
    console.log('   ✅ Production table setup completed');
  }
  
  static async mergeToMain() {
    try {
      // Read production config BEFORE switching branches
      console.log('   Reading production configuration...');
      let prodConfig;
      try {
        prodConfig = readFileSync('apprunner-prod.yaml', 'utf8');
        console.log('   ✅ Production configuration loaded');
      } catch (error) {
        throw new Error(`Could not read apprunner-prod.yaml: ${error.message}`);
      }
      
      // Fetch latest changes
      execSync('git fetch origin', { stdio: 'inherit' });
      
      // Stash any uncommitted changes
      try {
        execSync('git stash push -m "Auto-stash before prod merge"', { stdio: 'pipe' });
        console.log('   Stashed uncommitted changes');
      } catch (error) {
        // No changes to stash, continue
      }
      
      // Switch to main branch
      execSync('git checkout main', { stdio: 'inherit' });
      
      // Pull latest main with unrelated histories flag
      execSync('git pull origin main --allow-unrelated-histories', { stdio: 'inherit' });
      
      // Merge local dev into main with unrelated histories flag
      try {
        execSync('git merge dev --allow-unrelated-histories', { stdio: 'inherit' });
      } catch (mergeError) {
        // Handle merge conflicts automatically
        console.log('   Resolving merge conflicts...');
        try {
          // Keep main branch version of apprunner.yaml
          execSync('git checkout --ours apprunner.yaml', { stdio: 'pipe' });
          execSync('git add apprunner.yaml', { stdio: 'pipe' });
          execSync('git commit --no-edit', { stdio: 'pipe' });
          console.log('   ✅ Merge conflicts resolved automatically');
        } catch (resolveError) {
          throw new Error(`Failed to resolve merge conflicts: ${resolveError.message}`);
        }
      }
      
      // Update apprunner.yaml with production configuration AFTER merge
      console.log('   Updating apprunner.yaml with production configuration...');
      try {
        writeFileSync('apprunner.yaml', prodConfig);
        execSync('git add apprunner.yaml', { stdio: 'pipe' });
        execSync('git commit -m "Update apprunner.yaml for production deployment"', { stdio: 'pipe' });
        console.log('   ✅ Production apprunner.yaml configuration applied');
      } catch (error) {
        console.log('   ⚠️  Could not update apprunner.yaml:', error.message);
      }
      
      // Push to main
      execSync('git push origin main', { stdio: 'inherit' });
      
      // Switch back to dev and restore stashed changes
      execSync('git checkout dev', { stdio: 'inherit' });
      try {
        execSync('git stash pop', { stdio: 'pipe' });
        console.log('   Restored stashed changes');
      } catch (error) {
        // No stash to pop, continue
      }
      
      return true;
    } catch (error) {
      throw new Error(`Git merge failed: ${error.message}`);
    }
  }
}

async function main() {
  console.log('🚀 PRODUCTION PUSH SYSTEM\n');
  
  // Step 0: Get and confirm application name, AWS region, and backup directory
  await ProdPushManager.getApplicationName();
  await ProdPushManager.getAwsRegion();
  await ProdPushManager.getBackupDirectory();
  
  const results = {
    diffAnalysis: false,
    versionCalculation: false,
    tableSetup: false,
    backup: false,
    userApproval: false,
    databaseUpdate: false,
    releaseNotesUpdate: false,
    gitMerge: false
  };
  
  try {
    // Step 1: Analyze diff
    console.log('🔍 Analyzing changes between dev and main...');
    const changes = await ProdPushManager.analyzeDiff();
    results.diffAnalysis = true;
    console.log(`✅ Found ${changes.breaking.length} breaking, ${changes.features.length} features, ${changes.fixes.length} fixes`);
    
    // Step 2: Calculate version
    console.log('📊 Calculating next version...');
    const currentVersion = await ProdPushManager.getCurrentProdVersion();
    const nextVersion = ProdPushManager.calculateNextVersion(currentVersion, changes);
    const releaseNotes = ProdPushManager.generateReleaseNotes(changes, nextVersion);
    results.versionCalculation = true;
    
    // Step 3: Ensure production tables exist
    console.log('🗄️  Ensuring production database tables exist...');
    await ProdPushManager.ensureProdTables();
    results.tableSetup = true;
    console.log('✅ Production database tables ready');
    
    // Step 4: Create backup
    console.log('💾 Creating production backup...');
    const backupPath = await ProdPushManager.createBackup();
    results.backup = true;
    console.log(`✅ Backup created at: ${backupPath}`);
    
    // Step 5: Get user approval
    const approved = await ProdPushManager.getUserApproval(currentVersion, nextVersion, releaseNotes);
    if (!approved) {
      console.log('\n❌ Production push cancelled by user.');
      return;
    }
    results.userApproval = true;
    
    console.log('\n✅ Production push approved. Proceeding...\n');
    
    // Step 6: Update database
    console.log('📊 Updating production database...');
    await ProdPushManager.updateProdDatabase(nextVersion, releaseNotes, changes);
    results.databaseUpdate = true;
    console.log('✅ Production database updated');
    
    // Step 7: Update release notes page
    console.log('📝 Updating release notes page...');
    await ProdPushManager.updateReleaseNotesPage(nextVersion, releaseNotes);
    results.releaseNotesUpdate = true;
    
    // Step 8: Merge to main
    console.log('🔄 Merging dev to main branch...');
    await ProdPushManager.mergeToMain();
    results.gitMerge = true;
    console.log('✅ Successfully merged to main branch');
    
    // Success summary
    console.log('\n🎉 PRODUCTION PUSH COMPLETED SUCCESSFULLY!');
    console.log(`📦 Version: ${nextVersion}`);
    console.log(`🌍 Environment: Production`);
    console.log(`📊 Database: Updated`);
    console.log(`📝 Release Notes: Updated`);
    console.log(`🚀 Git: Merged to main`);
    
  } catch (error) {
    console.error('\n❌ PRODUCTION PUSH FAILED:', error.message);
    
    // Show what succeeded and what failed
    console.log('\n📊 OPERATION SUMMARY:');
    console.log(`   Diff Analysis: ${results.diffAnalysis ? '✅ Success' : '❌ Failed'}`);
    console.log(`   Version Calculation: ${results.versionCalculation ? '✅ Success' : '❌ Failed'}`);
    console.log(`   Table Setup: ${results.tableSetup ? '✅ Success' : '❌ Failed'}`);
    console.log(`   Backup Creation: ${results.backup ? '✅ Success' : '❌ Failed'}`);
    console.log(`   User Approval: ${results.userApproval ? '✅ Success' : '❌ Failed'}`);
    console.log(`   Database Update: ${results.databaseUpdate ? '✅ Success' : '❌ Failed'}`);
    console.log(`   Release Notes: ${results.releaseNotesUpdate ? '✅ Success' : '❌ Failed'}`);
    console.log(`   Git Merge: ${results.gitMerge ? '✅ Success' : '❌ Failed'}`);
    
    process.exit(1);
  }
}

main().catch(console.error);