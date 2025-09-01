#!/usr/bin/env node

import { db } from './lib/dynamodb.js';
import { v4 as uuidv4 } from 'uuid';

const coreFeatures = [
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
    name: 'User Authentication',
    description: 'SAML SSO and local authentication with role-based access control',
    category: 'Authentication',
    version: '1.0.0',
    changeType: 'baseline',
    dateAdded: new Date().toISOString(),
    status: 'active'
  },
  {
    id: uuidv4(),
    name: 'Real-time Updates (SSE)',
    description: 'Server-Sent Events for live updates and notifications',
    category: 'Real-time',
    version: '1.0.0',
    changeType: 'baseline',
    dateAdded: new Date().toISOString(),
    status: 'active'
  },
  {
    id: uuidv4(),
    name: 'Comment System',
    description: 'Issue commenting with attachments and real-time updates',
    category: 'Communication',
    version: '1.0.0',
    changeType: 'baseline',
    dateAdded: new Date().toISOString(),
    status: 'active'
  },
  {
    id: uuidv4(),
    name: 'WebEx Integration',
    description: 'Adaptive card notifications and direct messaging',
    category: 'Integration',
    version: '1.0.0',
    changeType: 'baseline',
    dateAdded: new Date().toISOString(),
    status: 'active'
  },
  {
    id: uuidv4(),
    name: 'File Storage',
    description: 'S3 integration for file uploads and attachments',
    category: 'Storage',
    version: '1.0.0',
    changeType: 'baseline',
    dateAdded: new Date().toISOString(),
    status: 'active'
  },
  {
    id: uuidv4(),
    name: 'Upvoting & Following',
    description: 'Issue upvoting and following system',
    category: 'Engagement',
    version: '1.0.0',
    changeType: 'baseline',
    dateAdded: new Date().toISOString(),
    status: 'active'
  },
  {
    id: uuidv4(),
    name: 'Admin Dashboard',
    description: 'User management and system administration',
    category: 'Administration',
    version: '1.0.0',
    changeType: 'baseline',
    dateAdded: new Date().toISOString(),
    status: 'active'
  },
  {
    id: uuidv4(),
    name: 'Automated Versioning',
    description: 'Semantic versioning with automated release notes',
    category: 'DevOps',
    version: '1.0.0',
    changeType: 'baseline',
    dateAdded: new Date().toISOString(),
    status: 'active'
  },
  {
    id: uuidv4(),
    name: 'Timezone Management',
    description: 'User timezone detection and timestamp display',
    category: 'Localization',
    version: '1.0.0',
    changeType: 'baseline',
    dateAdded: new Date().toISOString(),
    status: 'active'
  }
];

console.log('📝 Creating baseline features...');

for (const feature of coreFeatures) {
  try {
    await db.saveFeature(feature);
    console.log(`✅ ${feature.name}`);
  } catch (error) {
    console.error(`❌ Failed to save ${feature.name}:`, error.message);
  }
}

console.log(`\n🎯 Baseline created with ${coreFeatures.length} core features`);