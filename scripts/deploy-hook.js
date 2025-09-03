#!/usr/bin/env node

console.log('=== DEPLOYMENT HOOK SCRIPT STARTING ===');
console.log('Node version:', process.version);
console.log('Working directory:', process.cwd());
console.log('Script location:', __filename);

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get current version from package.json or default
function getCurrentVersion() {
  try {
    const packagePath = path.join(__dirname, '../package.json');
    if (fs.existsSync(packagePath)) {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      return pkg.version || '1.0.0';
    }
  } catch (error) {
    console.log('No package.json found, using default version');
  }
  return '1.0.0';
}

// Increment version number
function incrementVersion(version) {
  const parts = version.split('.').map(Number);
  const major = parts[0] || 1;
  const minor = parts[1] || 0;
  const patch = (parts[2] || 0) + 1;
  
  // Follow semantic versioning: MAJOR.MINOR.PATCH
  return `${major}.${minor}.${patch}`;
}

// Analyze git changes
function analyzeChanges() {
  try {
    const gitDiff = execSync('git diff HEAD~1 HEAD --name-only', { encoding: 'utf8' });
    const changedFiles = gitDiff.trim().split('\n').filter(f => f);
    
    const changes = {
      features: [],
      improvements: [],
      bugFixes: [],
      breaking: []
    };
    
    // Simple heuristics for categorizing changes
    changedFiles.forEach(file => {
      if (file.includes('api/') && file.endsWith('.js')) {
        changes.improvements.push(`Updated API endpoint: ${file}`);
      } else if (file.includes('components/')) {
        changes.improvements.push(`Updated component: ${file}`);
      } else if (file.includes('app/') && file.endsWith('page.js')) {
        changes.improvements.push(`Updated page: ${file}`);
      } else if (file.includes('lib/')) {
        changes.improvements.push(`Updated library: ${file}`);
      } else {
        changes.improvements.push(`Updated: ${file}`);
      }
    });
    
    return changes;
  } catch (error) {
    console.log('Could not analyze git changes, using default');
    return {
      features: [],
      improvements: ['Deployment update'],
      bugFixes: [],
      breaking: []
    };
  }
}

// Create release
async function createRelease() {
  try {
    const currentVersion = getCurrentVersion();
    const newVersion = incrementVersion(currentVersion);
    const changes = analyzeChanges();
    
    console.log(`=== DEPLOYMENT HOOK STARTING ===`);
    console.log(`Current version: ${currentVersion}`);
    console.log(`New version: ${newVersion}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Base URL: ${process.env.NEXTAUTH_URL || 'not set'}`);
    
    // Update package.json version immediately
    const packagePath = path.join(__dirname, '../package.json');
    if (fs.existsSync(packagePath)) {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      pkg.version = newVersion;
      fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
      console.log(`✅ Updated package.json to version ${newVersion}`);
    } else {
      console.log(`❌ package.json not found at ${packagePath}`);
    }
    
    // Create a release file that will be processed after deployment
    const releaseData = {
      version: newVersion,
      changes,
      type: 'Minor Release',
      date: new Date().toISOString().split('T')[0],
      timestamp: Date.now(),
      deploymentTime: new Date().toISOString()
    };
    
    const releaseFilePath = path.join(__dirname, '../pending-release.json');
    console.log(`📝 Creating pending release file at: ${releaseFilePath}`);
    console.log(`📊 Release data:`, JSON.stringify(releaseData, null, 2));
    
    fs.writeFileSync(releaseFilePath, JSON.stringify(releaseData, null, 2));
    
    // Verify file was created
    if (fs.existsSync(releaseFilePath)) {
      const fileSize = fs.statSync(releaseFilePath).size;
      console.log(`✅ Pending release file created successfully (${fileSize} bytes)`);
      console.log(`📂 File contents:`, fs.readFileSync(releaseFilePath, 'utf8'));
    } else {
      console.error(`❌ Failed to create pending release file at ${releaseFilePath}`);
    }
    
    // Don't try API call during build - it will be processed after deployment starts
    console.log(`📝 Release ${newVersion} prepared for post-deployment processing`);
    console.log(`🔍 Deploy hook will be processed when version API is called`);
    console.log(`📍 Pending release file location: ${releaseFilePath}`);
    
    // Setup WebEx integration from Parameter Store
    try {
      console.log('🔧 Setting up WebEx integration...');
      const { setupWebexIntegration } = require('./setup-webex');
      await setupWebexIntegration();
    } catch (error) {
      console.error('Error in WebEx setup:', error);
    }
    
    console.log(`=== DEPLOYMENT HOOK COMPLETED ===`);
    
    return true;
  } catch (error) {
    console.error(`❌ Deployment hook failed:`, error);
    return false;
  }
}

// Process pending release (for post-deployment)
async function processPendingRelease() {
  const releaseFilePath = path.join(__dirname, '../pending-release.json');
  
  if (!fs.existsSync(releaseFilePath)) {
    return false;
  }
  
  try {
    const releaseData = JSON.parse(fs.readFileSync(releaseFilePath, 'utf8'));
    console.log(`Processing pending release ${releaseData.version}...`);
    
    // Import database directly
    const { db } = require('../lib/dynamodb');
    await db.saveRelease(releaseData);
    
    console.log(`Release ${releaseData.version} saved to database`);
    
    // Remove pending file
    fs.unlinkSync(releaseFilePath);
    return true;
  } catch (error) {
    console.error('Error processing pending release:', error);
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  console.log('Deploy hook called directly, executing...');
  createRelease()
    .then((success) => {
      console.log(`Deploy hook completed with success: ${success}`);
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Deploy hook failed with error:', error);
      process.exit(1);
    });
} else {
  console.log('Deploy hook loaded as module');
}

module.exports = { createRelease, processPendingRelease };

module.exports = { createRelease };