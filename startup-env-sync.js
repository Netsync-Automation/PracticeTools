#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

function getCurrentBranch() {
  // In App Runner or production environment, skip git detection
  if (process.env.AWS_EXECUTION_ENV || process.env.NODE_ENV === 'production') {
    console.log('Running in AWS environment, skipping git branch detection');
    return null; // Let App Runner handle environment variables
  }
  
  try {
    const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    return branch;
  } catch (error) {
    console.log('Warning: Could not detect git branch, defaulting to dev');
    return 'dev';
  }
}

function updateEnvFile(branch) {
  const envPath = '.env.local';
  
  try {
    // Read current .env.local
    const envContent = readFileSync(envPath, 'utf8');
    
    // Determine environment settings based on branch
    const isProduction = branch === 'main';
    const nodeEnv = isProduction ? 'production' : 'development';
    const environment = isProduction ? 'prod' : 'dev';
    
    // Update NODE_ENV and ENVIRONMENT
    let updatedContent = envContent
      .replace(/^NODE_ENV=.*/m, `NODE_ENV=${nodeEnv}`)
      .replace(/^ENVIRONMENT=.*/m, `ENVIRONMENT=${environment}`);
    
    // Add NODE_ENV if it doesn't exist
    if (!envContent.includes('NODE_ENV=')) {
      updatedContent += `\nNODE_ENV=${nodeEnv}`;
    }
    
    // Add ENVIRONMENT if it doesn't exist
    if (!envContent.includes('ENVIRONMENT=')) {
      updatedContent += `\nENVIRONMENT=${environment}`;
    }
    
    // Write updated content
    writeFileSync(envPath, updatedContent);
    
    console.log(`🔧 Environment synced: ${branch} branch → NODE_ENV=${nodeEnv}, ENVIRONMENT=${environment}`);
    
  } catch (error) {
    console.error('Error updating .env.local:', error.message);
  }
}

function main() {
  const currentBranch = getCurrentBranch();
  
  // Skip env file update in AWS environments
  if (currentBranch === null) {
    console.log('🔧 Environment variables managed by AWS App Runner');
    return;
  }
  
  updateEnvFile(currentBranch);
}

main();