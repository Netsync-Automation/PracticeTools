#!/usr/bin/env node

/**
 * Reset Versioning System
 * Clears all existing releases and features, creates new 1.0.0 baseline
 */

import { DynamoDBClient, ScanCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { FeatureVersioning } from './lib/auto-versioning.js';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: '.env.local' });

const client = new DynamoDBClient({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function clearTable(tableName, keyName) {
  try {
    console.log(`🗑️ Clearing ${tableName}...`);
    
    const scanCommand = new ScanCommand({ TableName: tableName });
    const result = await client.send(scanCommand);
    
    if (result.Items && result.Items.length > 0) {
      for (const item of result.Items) {
        const deleteCommand = new DeleteItemCommand({
          TableName: tableName,
          Key: { [keyName]: item[keyName] }
        });
        await client.send(deleteCommand);
      }
      console.log(`✅ Deleted ${result.Items.length} items from ${tableName}`);
    } else {
      console.log(`📋 ${tableName} is already empty`);
    }
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      console.log(`📋 ${tableName} does not exist`);
    } else {
      console.error(`❌ Error clearing ${tableName}:`, error);
    }
  }
}

async function resetVersioning() {
  console.log('🔄 RESETTING VERSIONING SYSTEM TO 1.0.0 BASELINE');
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  
  try {
    // Clear existing releases
    await clearTable('PracticeTools-Releases', 'version');
    
    // Clear existing features
    await clearTable('PracticeTools-Features', 'id');
    
    // Create new 1.0.0 baseline
    console.log('🏗️ Creating new 1.0.0 baseline...');
    const features = await FeatureVersioning.initializeBaseline();
    
    // Generate 1.0.0 release notes
    const release = {
      version: '1.0.0',
      date: new Date().toISOString().split('T')[0],
      type: 'Major Release',
      notes: `## 🎉 Initial Release - Netsync Issues Tracker v1.0.0

Welcome to the comprehensive issue tracking system designed for modern teams!

## ✨ Core Features

- **Complete Issue Management**: Create, track, and resolve bug reports, feature requests, and general questions
- **Smart Duplicate Detection**: AI-powered duplicate prevention using TF-IDF similarity matching
- **Real-time Collaboration**: Live updates, comments, and notifications via Server-Sent Events
- **WebEx Integration**: Seamless notifications and adaptive cards for team communication
- **Advanced Search & Filtering**: Powerful tools to find and organize issues efficiently

## 🔄 Workflow Management

- **Status Tracking**: Open → In Progress → Pending Testing → Backlog → Rejected → Closed
- **Assignment System**: Admin-controlled issue assignment with requirement enforcement
- **Resolution Comments**: Mandatory detailed resolution notes for closed issues
- **Status History**: Complete audit trail of all changes with timestamps

## 👥 User Experience

- **Upvoting System**: Community-driven issue prioritization
- **Following System**: Stay updated on issues you care about
- **File Attachments**: Support for images, documents, and various file types
- **Emoji Support**: Express yourself with emoji picker in comments
- **Responsive Design**: Optimized for desktop and mobile devices

## 🔒 Security & Authentication

- **SAML SSO Integration**: Enterprise-grade single sign-on
- **Role-based Access**: Admin and user permissions with proper controls
- **Secure File Storage**: AWS S3 integration with access controls
- **Session Management**: Secure authentication with automatic logout

## 🤖 Automation & Intelligence

- **Automated Versioning**: Semantic versioning with feature change detection
- **Release Notes Generation**: Automatic user-friendly release documentation
- **Weekly Analytics**: Comprehensive reporting sent to administrators
- **Post-deployment Processing**: Automatic feature tracking and version management

## 📊 Admin Dashboard

- **System Statistics**: Real-time metrics and issue counts
- **User Management**: Create, edit, and manage user accounts
- **Assigned Issues View**: Dedicated workspace for admin-assigned tasks
- **Settings Management**: Configure WebEx integration and system preferences

This release establishes the foundation for efficient issue tracking and team collaboration.`,
      changes: {
        added: features.length,
        modified: 0,
        removed: 0
      }
    };
    
    // Save the baseline release
    const { db } = await import('./lib/dynamodb.js');
    await db.saveRelease(release);
    
    // Update version in settings
    await db.saveSetting('current_version', '1.0.0');
    
    console.log('✅ VERSIONING SYSTEM RESET COMPLETE');
    console.log(`📦 Created baseline with ${features.length} features`);
    console.log('🎯 Version 1.0.0 established as new baseline');
    console.log('📝 Release notes generated and saved');
    
  } catch (error) {
    console.error('❌ RESET FAILED:', error);
    process.exit(1);
  }
}

resetVersioning();