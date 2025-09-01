#!/usr/bin/env node

console.log('=== POST-BUILD SCRIPT STARTING ===');

const fs = require('fs');
const path = require('path');

try {
  // Simple version increment
  const packagePath = path.join(process.cwd(), 'package.json');
  console.log('Looking for package.json at:', packagePath);
  
  if (fs.existsSync(packagePath)) {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    console.log('Current version:', pkg.version);
    
    // Increment patch version
    const versionParts = pkg.version.split('.');
    const newPatch = parseInt(versionParts[2] || 0) + 1;
    const newVersion = `${versionParts[0]}.${versionParts[1]}.${newPatch}`;
    
    pkg.version = newVersion;
    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
    console.log('Updated version to:', newVersion);
    
    // Create simple release data
    const releaseData = {
      version: newVersion,
      date: new Date().toISOString().split('T')[0],
      type: 'Minor Release',
      features: ['Deployment update'],
      improvements: ['System maintenance and updates'],
      bugFixes: [],
      breaking: [],
      timestamp: Date.now()
    };
    
    const releaseFilePath = path.join(process.cwd(), 'pending-release.json');
    fs.writeFileSync(releaseFilePath, JSON.stringify(releaseData, null, 2));
    console.log('Created pending release file:', releaseFilePath);
    
    console.log('=== POST-BUILD SCRIPT COMPLETED SUCCESSFULLY ===');
  } else {
    console.log('package.json not found');
  }
} catch (error) {
  console.error('Post-build script error:', error);
  process.exit(1);
}