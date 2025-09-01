#!/usr/bin/env node

import { db } from './lib/dynamodb.js';
import { v4 as uuidv4 } from 'uuid';
import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

console.log('🔍 COMPREHENSIVE FEATURE CATALOGING - SCANNING ENTIRE CODEBASE\n');

const features = [];

// Scan ALL API endpoints
console.log('📡 Scanning API endpoints...');
const apiEndpoints = findFiles('app/api', 'route.js');
apiEndpoints.forEach(endpoint => {
  const pathParts = endpoint.replace('app/api/', '').replace('/route.js', '').split('/');
  const apiName = pathParts.join('/') || 'root';
  
  features.push({
    id: uuidv4(),
    name: `${apiName} API Endpoint`,
    description: `API endpoint: ${endpoint}`,
    category: 'API Endpoint',
    version: '1.0.0',
    changeType: 'baseline',
    dateAdded: new Date().toISOString(),
    status: 'active',
    filePath: endpoint
  });
});

// Scan ALL React components
console.log('🧩 Scanning React components...');
const components = findFiles('components', '.js');
components.forEach(component => {
  const componentName = component.split('/').pop().replace('.js', '');
  
  features.push({
    id: uuidv4(),
    name: `${componentName} Component`,
    description: `React component: ${component}`,
    category: 'UI Component',
    version: '1.0.0',
    changeType: 'baseline',
    dateAdded: new Date().toISOString(),
    status: 'active',
    filePath: component
  });
});

// Scan ALL pages and layouts
console.log('📄 Scanning pages and layouts...');
const pages = [...findFiles('app', 'page.js'), ...findFiles('app', 'layout.js')];
pages.forEach(page => {
  const pathParts = page.replace('app/', '').replace('/page.js', '').replace('/layout.js', '').split('/');
  const pageName = pathParts.join('/') || 'root';
  const isLayout = page.includes('layout.js');
  
  features.push({
    id: uuidv4(),
    name: `${pageName} ${isLayout ? 'Layout' : 'Page'}`,
    description: `${isLayout ? 'Layout' : 'Page'}: ${page}`,
    category: 'Page/Layout',
    version: '1.0.0',
    changeType: 'baseline',
    dateAdded: new Date().toISOString(),
    status: 'active',
    filePath: page
  });
});

// Scan ALL library services
console.log('📚 Scanning library services...');
const services = findFiles('lib', '.js');
services.forEach(service => {
  const serviceName = service.split('/').pop().replace('.js', '');
  
  features.push({
    id: uuidv4(),
    name: `${serviceName} Service`,
    description: `Library service: ${service}`,
    category: 'Library/Service',
    version: '1.0.0',
    changeType: 'baseline',
    dateAdded: new Date().toISOString(),
    status: 'active',
    filePath: service
  });
});

// Scan ALL scripts and utilities
console.log('⚙️ Scanning scripts and utilities...');
const scripts = [
  ...findFiles('.', '.js').filter(f => !f.includes('node_modules') && !f.includes('.next') && !f.includes('app/') && !f.includes('components/') && !f.includes('lib/')),
  ...findFiles('.', '.yaml'),
  ...findFiles('.', '.yml'),
  ...findFiles('.', '.json').filter(f => !f.includes('node_modules') && !f.includes('.next'))
];

scripts.forEach(script => {
  const scriptName = script.split('/').pop();
  let category = 'Configuration';
  
  if (script.includes('.js')) category = 'Script/Utility';
  if (script.includes('package.json')) category = 'Package Configuration';
  if (script.includes('apprunner')) category = 'Deployment Configuration';
  
  features.push({
    id: uuidv4(),
    name: scriptName,
    description: `${category}: ${script}`,
    category: category,
    version: '1.0.0',
    changeType: 'baseline',
    dateAdded: new Date().toISOString(),
    status: 'active',
    filePath: script
  });
});

// Add detailed functional features from FEATURE_INVENTORY.md
console.log('📋 Adding detailed functional features...');
const functionalFeatures = [
  {
    name: 'Issue Creation & Validation',
    description: 'Form validation, character limits, duplicate detection with TF-IDF algorithm',
    category: 'Issue Management'
  },
  {
    name: 'Issue Status Workflow',
    description: 'Open → In Progress → Pending Testing → Backlog → Rejected → Closed workflow',
    category: 'Issue Management'
  },
  {
    name: 'Issue Assignment System',
    description: 'Admin-only assignment with requirement before status changes',
    category: 'Issue Management'
  },
  {
    name: 'Duplicate Detection Algorithm',
    description: 'TF-IDF + Cosine Similarity for accurate duplicate detection',
    category: 'AI/ML Feature'
  },
  {
    name: 'File Upload System',
    description: 'S3 integration with 5MB limit, 5 files max, multiple formats',
    category: 'File Management'
  },
  {
    name: 'SAML SSO Authentication',
    description: 'Primary authentication method with session management',
    category: 'Authentication'
  },
  {
    name: 'Local Authentication',
    description: 'Username/password with bcrypt hashing backup authentication',
    category: 'Authentication'
  },
  {
    name: 'Role-Based Access Control',
    description: 'Admin/user roles with permission-based UI and API protection',
    category: 'Authorization'
  },
  {
    name: 'Server-Sent Events (SSE)',
    description: 'Real-time updates for homepage and individual issue pages',
    category: 'Real-time Communication'
  },
  {
    name: 'Auto-reconnection SSE',
    description: 'Automatic reconnection on connection loss with heartbeat monitoring',
    category: 'Real-time Communication'
  },
  {
    name: 'Comment System with Attachments',
    description: 'Rich text comments with file attachments and emoji support',
    category: 'Communication'
  },
  {
    name: 'Image Paste Functionality',
    description: 'Ctrl+V paste for screenshots in comments',
    category: 'Communication'
  },
  {
    name: 'WebEx Adaptive Cards',
    description: 'Color-coded status cards with action buttons',
    category: 'WebEx Integration'
  },
  {
    name: 'WebEx Direct Messaging',
    description: 'Automated notifications to issue creators and followers',
    category: 'WebEx Integration'
  },
  {
    name: 'Resolution Comments System',
    description: 'Mandatory resolution comments when closing issues',
    category: 'Issue Resolution'
  },
  {
    name: 'Upvoting System',
    description: 'User upvoting with duplicate issue upvote option',
    category: 'Engagement'
  },
  {
    name: 'Following System',
    description: 'Auto-follow for creators/commenters + manual follow/unfollow',
    category: 'Engagement'
  },
  {
    name: 'Status History Audit',
    description: 'Complete audit trail of all status changes with timestamps',
    category: 'Audit/Tracking'
  },
  {
    name: 'User Management CRUD',
    description: 'Create, read, update, delete users with role management',
    category: 'User Management'
  },
  {
    name: 'Password Reset System',
    description: 'Admin password reset functionality for local users',
    category: 'User Management'
  },
  {
    name: 'Issue Renumbering',
    description: 'Admin tool to resequence all issue numbers',
    category: 'Data Management'
  },
  {
    name: 'Automated Semantic Versioning',
    description: 'SemVer 2.0.0 compliant versioning with change classification',
    category: 'DevOps/Automation'
  },
  {
    name: 'Interactive Commit Approval',
    description: 'Preview and approve commits with release notes generation',
    category: 'DevOps/Automation'
  },
  {
    name: 'Timezone Detection & Display',
    description: 'Automatic browser timezone detection with consistent formatting',
    category: 'Localization'
  },
  {
    name: 'Relative Time Display',
    description: 'Smart relative formatting (2h ago, 3d ago) with tooltips',
    category: 'Localization'
  },
  {
    name: 'Table/Card View Toggle',
    description: 'Homepage view mode toggle with localStorage persistence',
    category: 'UI/UX'
  },
  {
    name: 'Advanced Search & Filtering',
    description: 'Search by type, status, terms with My Issues/Follows/Upvotes filters',
    category: 'Search/Filter'
  },
  {
    name: 'Column Sorting System',
    description: 'Clickable headers with asc/desc sorting and clear options',
    category: 'Search/Filter'
  },
  {
    name: 'Pagination System',
    description: '50 issues per page with navigation controls',
    category: 'Navigation'
  },
  {
    name: 'Breadcrumb Navigation',
    description: 'Context-aware navigation paths',
    category: 'Navigation'
  },
  {
    name: 'Audio Notifications',
    description: 'Pleasant sound alerts for new comments',
    category: 'Notifications'
  },
  {
    name: 'Browser Tab Flashing',
    description: 'Tab flashing when page not visible for new updates',
    category: 'Notifications'
  },
  {
    name: 'DynamoDB Multi-table Architecture',
    description: 'Issues, Users, Upvotes, Followers, StatusLog, Settings, Releases tables',
    category: 'Database Architecture'
  },
  {
    name: 'Environment-specific Tables',
    description: 'Separate dev/prod table prefixes for data isolation',
    category: 'Database Architecture'
  },
  {
    name: 'Breaking Change Prevention Protocol',
    description: 'Automated feature tracking and breaking change risk analysis',
    category: 'Quality Assurance'
  }
];

functionalFeatures.forEach(feature => {
  features.push({
    id: uuidv4(),
    name: feature.name,
    description: feature.description,
    category: feature.category,
    version: '1.0.0',
    changeType: 'baseline',
    dateAdded: new Date().toISOString(),
    status: 'active'
  });
});

console.log(`\n📊 COMPREHENSIVE CATALOG SUMMARY:`);
console.log(`   Total Features: ${features.length}`);

const categories = {};
features.forEach(feature => {
  categories[feature.category] = (categories[feature.category] || 0) + 1;
});

Object.entries(categories).forEach(([category, count]) => {
  console.log(`   ${category}: ${count}`);
});

console.log('\n💾 Saving all features to database...');

for (const feature of features) {
  try {
    await db.saveFeature(feature);
  } catch (error) {
    console.error(`❌ Failed to save ${feature.name}:`, error.message);
  }
}

console.log(`\n✅ COMPREHENSIVE CATALOG COMPLETED: ${features.length} features cataloged`);

function findFiles(dir, pattern) {
  const files = [];
  
  try {
    const items = readdirSync(dir);
    
    items.forEach(item => {
      if (item.startsWith('.') || item === 'node_modules' || item === '.next') return;
      
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        files.push(...findFiles(fullPath, pattern));
      } else if (item.includes(pattern)) {
        files.push(fullPath.replace(/\\/g, '/'));
      }
    });
  } catch (error) {
    // Directory doesn't exist or can't be read
  }
  
  return files;
}