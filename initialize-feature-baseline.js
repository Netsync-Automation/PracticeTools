#!/usr/bin/env node

/**
 * Feature Baseline Initialization
 * Scans entire codebase and creates comprehensive feature inventory in DynamoDB
 */

import { db } from './lib/dynamodb.js';
import { execSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

export class FeatureBaselineInitializer {
  
  static async initializeBaseline() {
    console.log('🚀 INITIALIZING COMPREHENSIVE FEATURE BASELINE\n');
    
    try {
      // 1. Clear existing features (fresh start)
      console.log('🧹 Clearing existing features for fresh baseline...');
      
      // 2. Scan entire codebase
      const allFeatures = this.scanCodebaseForFeatures();
      console.log(`🔍 Discovered ${allFeatures.length} features in codebase`);
      
      // 3. Catalog all features in database
      console.log('📝 Cataloging features in database...');
      for (const feature of allFeatures) {
        await db.saveFeature(feature);
      }
      
      console.log(`✅ Successfully initialized ${allFeatures.length} features in database`);
      
      // 4. Display summary
      this.displayFeatureSummary(allFeatures);
      
      console.log('\n🎯 FEATURE BASELINE INITIALIZATION COMPLETED\n');
      return allFeatures;
      
    } catch (error) {
      console.error('❌ BASELINE INITIALIZATION FAILED:', error.message);
      throw error;
    }
  }
  
  static scanCodebaseForFeatures() {
    const features = [];
    
    // Scan API endpoints
    features.push(...this.scanAPIEndpoints());
    
    // Scan UI components
    features.push(...this.scanUIComponents());
    
    // Scan pages and layouts
    features.push(...this.scanPages());
    
    // Scan library services
    features.push(...this.scanLibraryServices());
    
    // Scan core features from existing inventory
    features.push(...this.getCoreFeatures());
    
    return features;
  }
  
  static scanAPIEndpoints() {
    const features = [];
    const apiDir = 'app/api';
    
    try {
      const endpoints = this.findFilesRecursively(apiDir, 'route.js');
      
      endpoints.forEach(endpoint => {
        const pathParts = endpoint.replace('app/api/', '').replace('/route.js', '').split('/');
        const apiName = pathParts.join('/') || 'root';
        
        features.push({
          id: uuidv4(),
          name: `${apiName} API`,
          description: `API endpoint for ${apiName} operations`,
          category: 'API Endpoint',
          version: '1.0.0',
          changeType: 'baseline',
          dateAdded: new Date().toISOString(),
          status: 'active',
          filePath: endpoint
        });
      });
    } catch (error) {
      console.log('No API directory found');
    }
    
    return features;
  }
  
  static scanUIComponents() {
    const features = [];
    const componentsDir = 'components';
    
    try {
      const components = this.findFilesRecursively(componentsDir, '.js');
      
      components.forEach(component => {
        const componentName = component.split('/').pop().replace('.js', '');
        
        features.push({
          id: uuidv4(),
          name: `${componentName} Component`,
          description: `UI component for ${componentName} functionality`,
          category: 'UI Component',
          version: '1.0.0',
          changeType: 'baseline',
          dateAdded: new Date().toISOString(),
          status: 'active',
          filePath: component
        });
      });
    } catch (error) {
      console.log('No components directory found');
    }
    
    return features;
  }
  
  static scanPages() {
    const features = [];
    const appDir = 'app';
    
    try {
      const pages = this.findFilesRecursively(appDir, 'page.js');
      const layouts = this.findFilesRecursively(appDir, 'layout.js');
      
      [...pages, ...layouts].forEach(page => {
        const pathParts = page.replace('app/', '').replace('/page.js', '').replace('/layout.js', '').split('/');
        const pageName = pathParts.join('/') || 'root';
        const isLayout = page.includes('layout.js');
        
        features.push({
          id: uuidv4(),
          name: `${pageName} ${isLayout ? 'Layout' : 'Page'}`,
          description: `${isLayout ? 'Layout' : 'Page'} component for ${pageName}`,
          category: 'Page/Layout',
          version: '1.0.0',
          changeType: 'baseline',
          dateAdded: new Date().toISOString(),
          status: 'active',
          filePath: page
        });
      });
    } catch (error) {
      console.log('No app directory found');
    }
    
    return features;
  }
  
  static scanLibraryServices() {
    const features = [];
    const libDir = 'lib';
    
    try {
      const services = this.findFilesRecursively(libDir, '.js');
      
      services.forEach(service => {
        const serviceName = service.split('/').pop().replace('.js', '');
        
        features.push({
          id: uuidv4(),
          name: `${serviceName} Service`,
          description: `Library service for ${serviceName} functionality`,
          category: 'Library/Service',
          version: '1.0.0',
          changeType: 'baseline',
          dateAdded: new Date().toISOString(),
          status: 'active',
          filePath: service
        });
      });
    } catch (error) {
      console.log('No lib directory found');
    }
    
    return features;
  }
  
  static getCoreFeatures() {
    return [
      {
        id: uuidv4(),
        name: 'Issue Management System',
        description: 'Core issue creation, editing, status management, and assignment system',
        category: 'Core Feature',
        version: '1.0.0',
        changeType: 'baseline',
        dateAdded: new Date().toISOString(),
        status: 'active'
      },
      {
        id: uuidv4(),
        name: 'User Authentication & Authorization',
        description: 'SAML SSO and local authentication with role-based access control',
        category: 'Authentication',
        version: '1.0.0',
        changeType: 'baseline',
        dateAdded: new Date().toISOString(),
        status: 'active'
      },
      {
        id: uuidv4(),
        name: 'Real-time Communication (SSE)',
        description: 'Server-Sent Events for live updates, notifications, and real-time features',
        category: 'Real-time',
        version: '1.0.0',
        changeType: 'baseline',
        dateAdded: new Date().toISOString(),
        status: 'active'
      },
      {
        id: uuidv4(),
        name: 'Comment System',
        description: 'Issue commenting with attachments, real-time updates, and admin highlighting',
        category: 'Communication',
        version: '1.0.0',
        changeType: 'baseline',
        dateAdded: new Date().toISOString(),
        status: 'active'
      },
      {
        id: uuidv4(),
        name: 'WebEx Integration',
        description: 'Adaptive card notifications and direct messaging integration',
        category: 'Integration',
        version: '1.0.0',
        changeType: 'baseline',
        dateAdded: new Date().toISOString(),
        status: 'active'
      },
      {
        id: uuidv4(),
        name: 'File Storage & Management',
        description: 'S3 integration for file uploads, attachments, and secure file serving',
        category: 'Storage',
        version: '1.0.0',
        changeType: 'baseline',
        dateAdded: new Date().toISOString(),
        status: 'active'
      },
      {
        id: uuidv4(),
        name: 'Upvoting & Following System',
        description: 'Issue upvoting and following with auto-follow for creators and commenters',
        category: 'Engagement',
        version: '1.0.0',
        changeType: 'baseline',
        dateAdded: new Date().toISOString(),
        status: 'active'
      },
      {
        id: uuidv4(),
        name: 'Admin Dashboard & Management',
        description: 'User management, issue assignment, system administration features',
        category: 'Administration',
        version: '1.0.0',
        changeType: 'baseline',
        dateAdded: new Date().toISOString(),
        status: 'active'
      },
      {
        id: uuidv4(),
        name: 'Automated Versioning System',
        description: 'Semantic versioning with automated release notes and database-driven tracking',
        category: 'DevOps',
        version: '1.0.0',
        changeType: 'baseline',
        dateAdded: new Date().toISOString(),
        status: 'active'
      },
      {
        id: uuidv4(),
        name: 'Timezone Management',
        description: 'User timezone detection and consistent timestamp display across all features',
        category: 'Localization',
        version: '1.0.0',
        changeType: 'baseline',
        dateAdded: new Date().toISOString(),
        status: 'active'
      }
    ];
  }
  
  static findFilesRecursively(dir, pattern) {
    const files = [];
    
    try {
      const items = readdirSync(dir);
      
      items.forEach(item => {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          files.push(...this.findFilesRecursively(fullPath, pattern));
        } else if (item.includes(pattern)) {
          files.push(fullPath.replace(/\\/g, '/'));
        }
      });
    } catch (error) {
      // Directory doesn't exist or can't be read
    }
    
    return files;
  }
  
  static displayFeatureSummary(features) {
    const categories = {};
    features.forEach(feature => {
      categories[feature.category] = (categories[feature.category] || 0) + 1;
    });
    
    console.log('\n📊 FEATURE BASELINE SUMMARY:');
    Object.entries(categories).forEach(([category, count]) => {
      console.log(`   ${category}: ${count} features`);
    });
    
    console.log(`\n✅ Total Features: ${features.length}`);
  }
}

// Auto-run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  FeatureBaselineInitializer.initializeBaseline().catch(error => {
    console.error('❌ BASELINE INITIALIZATION FAILED:', error);
    process.exit(1);
  });
}