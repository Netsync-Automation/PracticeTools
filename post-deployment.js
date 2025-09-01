#!/usr/bin/env node

/**
 * Post-Deployment Hook for AWS App Runner
 * Executes after successful deployment to process feature changes and versioning
 */

import { FeatureVersioning } from './lib/auto-versioning.js';

async function postDeploymentHook() {
  console.log('🚀 POST-DEPLOYMENT HOOK STARTED');
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'production'}`);
  
  try {
    // Wait for application to be fully ready
    console.log('⏳ Waiting for application to be ready...');
    await new Promise(resolve => setTimeout(resolve, 30000)); // 30 second delay
    
    // Process deployment versioning
    console.log('🔄 Processing feature changes and versioning...');
    const release = await FeatureVersioning.processDeployment();
    
    if (release) {
      console.log(`✅ New release created: ${release.version}`);
      console.log(`📋 Release type: ${release.type}`);
      console.log(`📝 Changes: ${release.changes.added} added, ${release.changes.modified} modified, ${release.changes.removed} removed`);
      
      // Log release details for monitoring
      console.log('📊 RELEASE METRICS:', JSON.stringify({
        version: release.version,
        type: release.type,
        changes: release.changes,
        timestamp: new Date().toISOString()
      }));
    } else {
      console.log('📋 No feature changes detected - no new release created');
    }
    
    console.log('✅ POST-DEPLOYMENT HOOK COMPLETED SUCCESSFULLY');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ POST-DEPLOYMENT HOOK FAILED');
    console.error('🔍 Error Details:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'production'
    });
    
    // Don't fail the deployment, just log the error
    console.log('⚠️  Continuing deployment despite versioning error');
    process.exit(0);
  }
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  postDeploymentHook();
}

export { postDeploymentHook };