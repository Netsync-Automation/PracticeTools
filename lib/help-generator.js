import { readFileSync } from 'fs';
import { join } from 'path';

export class HelpGenerator {
  static parseFeatureInventory() {
    try {
      const inventoryPath = join(process.cwd(), 'FEATURE_INVENTORY.md');
      const inventory = readFileSync(inventoryPath, 'utf8');
      
      const categories = {};
      const lines = inventory.split('\n');
      let currentCategory = '';
      
      for (const line of lines) {
        if (line.startsWith('### ')) {
          currentCategory = line.replace('### ', '').trim();
          categories[currentCategory] = [];
        } else if (line.startsWith('- **') && line.includes('**:') && currentCategory) {
          const match = line.match(/- \*\*(.+?)\*\*: (.+)/);
          if (match) {
            categories[currentCategory].push({
              name: match[1],
              description: match[2]
            });
          }
        }
      }
      
      return categories;
    } catch (error) {
      console.error('Error parsing feature inventory:', error);
      return {};
    }
  }

  static generateHelpContent() {
    const features = this.parseFeatureInventory();
    
    const helpCategories = {
      'getting-started': {
        title: 'Getting Started',
        icon: '🚀',
        articles: [
          { id: 'overview', title: 'System Overview', content: 'Learn about the Netsync Issues Tracker and its comprehensive features for modern teams.' },
          { id: 'first-login', title: 'First Time Login', content: 'Step-by-step guide for your first login and account setup with authentication options.' },
          { id: 'navigation', title: 'Navigating the Interface', content: 'Understanding the main navigation, dashboard, and user interface elements.' }
        ]
      },
      'issues': {
        title: 'Managing Issues',
        icon: '📋',
        articles: [
          { id: 'create-issue', title: 'Creating an Issue', content: 'How to create and submit new issues with smart duplicate detection and file attachments.' },
          { id: 'view-issues', title: 'Viewing Issues', content: 'Browse, search, and filter issues with advanced search capabilities and multiple view modes.' },
          { id: 'update-issue', title: 'Updating Issues', content: 'Edit issue details, manage status changes, and track issue lifecycle with audit trails.' },
          { id: 'follow-issues', title: 'Following Issues', content: 'How to follow issues for real-time notifications and stay updated on progress.' },
          { id: 'upvote-issues', title: 'Upvoting Issues', content: 'Show support for issues by upvoting them and help prioritize community needs.' }
        ]
      },
      'comments': {
        title: 'Comments & Communication',
        icon: '💬',
        articles: [
          { id: 'add-comments', title: 'Adding Comments', content: 'How to add comments with rich text, emoji support, and real-time collaboration.' },
          { id: 'attachments', title: 'File Attachments', content: 'Upload files, paste images, and manage attachments with secure cloud storage.' },
          { id: 'notifications', title: 'Notifications', content: 'Understanding WebEx integration, real-time updates, and notification preferences.' }
        ]
      },
      'collaboration': {
        title: 'Team Collaboration',
        icon: '👥',
        articles: [
          { id: 'webex-integration', title: 'WebEx Integration', content: 'Seamless team communication with adaptive cards and direct messaging.' },
          { id: 'real-time-updates', title: 'Real-time Features', content: 'Live updates, instant notifications, and collaborative editing capabilities.' },
          { id: 'following-system', title: 'Following & Notifications', content: 'Advanced following system with auto-follow and notification management.' }
        ]
      },
      'admin': {
        title: 'Administration',
        icon: '⚙️',
        articles: [
          { id: 'user-management', title: 'User Management', content: 'Managing users, roles, permissions, and authentication methods including SAML SSO.' },
          { id: 'settings', title: 'System Settings', content: 'Configure application settings, integrations, and system-wide preferences.' },
          { id: 'analytics', title: 'Analytics & Reporting', content: 'Weekly analytics, system statistics, and comprehensive reporting features.' },
          { id: 'automation', title: 'Automation Features', content: 'Automated versioning, release notes generation, and deployment processing.' }
        ]
      }
    };

    // Generate detailed article content based on features
    const articleContent = this.generateArticleContent(features);
    
    // Generate FAQ based on features
    const faqData = this.generateFAQ(features);

    return {
      helpCategories,
      articleContent,
      faqData
    };
  }

  static generateArticleContent(features) {
    return {
      'overview': `
# System Overview

The Netsync Issues Tracker is a comprehensive issue management system designed for modern teams with advanced collaboration features.

## Core Capabilities
${features['Issue Management']?.map(f => `- **${f.name}**: ${f.description}`).join('\n') || ''}

## Real-time Features
${features['Real-time Features']?.map(f => `- **${f.name}**: ${f.description}`).join('\n') || ''}

## Security & Authentication
${features['Authentication & Security']?.map(f => `- **${f.name}**: ${f.description}`).join('\n') || ''}

## Integration Features
${features['WebEx Integration']?.map(f => `- **${f.name}**: ${f.description}`).join('\n') || ''}
      `,
      'first-login': `
# First Time Login

Welcome to the Netsync Issues Tracker! Here's how to get started:

## Login Process
1. Navigate to the login page
2. Enter your credentials (email and password or use SAML SSO)
3. Click "Sign In" to access the system

## Initial Setup
- Review your profile information in the user dropdown
- Familiarize yourself with the main navigation
- Explore the dashboard to see existing issues

## Next Steps
- Create your first issue using the "New Issue" button
- Browse existing issues to understand the system
- Follow issues you're interested in for notifications
      `,
      'navigation': `
# Navigating the Interface

Understanding the main interface elements will help you use the system effectively.

## Top Navigation
- **Logo**: Click to return to the main dashboard
- **New Issue**: Create a new issue from anywhere
- **Admin**: Access admin features (admin users only)
- **User Menu**: Access help, about, and logout options

## Main Dashboard
- **Stats Cards**: Overview of total, open, and closed issues
- **Filters**: Search and filter issues by type, status, and keywords
- **View Modes**: Switch between table and card views
- **Issue List**: Browse all issues with key information

## Issue Details
- **Issue Information**: Title, description, status, and metadata
- **Comments**: Discussion thread with team members
- **Actions**: Follow, upvote, edit (if permitted)
      `,
      'create-issue': `
# Creating an Issue

Create comprehensive issue reports with advanced features:

## Issue Creation Process
1. **Smart Duplicate Detection**: AI-powered TF-IDF similarity matching prevents duplicate submissions
2. **Issue Types**: Choose from Bug Report, Feature Request, or General Question
3. **Rich Content**: Add detailed descriptions with file attachments and problem links
4. **Automatic Numbering**: Issues get unique sequential numbers for easy tracking

## Advanced Features
${features['Issue Creation']?.map(f => `- **${f.name}**: ${f.description}`).join('\n') || ''}

## File Attachments
- Support for multiple file types with secure S3 storage
- Drag and drop functionality
- Image pasting from clipboard
- File size limits and security scanning
      `,
      'view-issues': `
# Viewing Issues

The system provides multiple ways to view and find issues:

## View Modes
- **Table View**: Compact list with key information in columns
- **Card View**: Detailed cards showing more information per issue

## Filtering Options
- **Search**: Find issues by title, description, email, or issue number
- **Type Filter**: Bug Report, Feature Request, General Question
- **Status Filter**: Open, In Progress, Closed, etc.
- **Sort Options**: Newest first or most upvotes

## Issue Information
Each issue displays:
- Issue number and title
- Type and current status
- Creator and creation date
- Upvote count and follow status
- Attachment indicators
- Quick action buttons
      `,
      'update-issue': `
# Updating Issues

Keep issues current with updates and status changes:

## Who Can Update
- **Issue Creators**: Can edit title, description, and problem link
- **Admins**: Can edit any issue and change status

## Editing Content
1. Click "View/Edit" on an issue you can modify
2. Use edit buttons next to title and description
3. Make changes and save
4. Changes are logged and visible to all users

## Status Updates
Admins can change issue status:
- **Open**: New or active issues
- **In Progress**: Currently being worked on
- **Pending Testing**: Awaiting verification
- **Closed**: Resolved issues
- **Rejected**: Issues that won't be addressed
      `,
      'follow-issues': `
# Following Issues

Stay informed about issues that matter to you:

## Automatic Following
You automatically follow issues when you:
- Create an issue
- Comment on an issue

## Manual Following
- Click the "Follow" button on any issue
- Button shows "Following" when active
- Click again to unfollow

## Notifications
When following an issue, you receive:
- WebEx direct messages for new comments
- Email notifications (if configured)
- Real-time updates in the interface
      `,
      'upvote-issues': `
# Upvoting Issues

Show support for issues that affect you:

## How to Upvote
- Click the thumbs up (👍) button on any issue
- You can only upvote each issue once
- Upvote count is visible to all users

## When to Upvote
- You're experiencing the same problem
- You agree the feature should be implemented
- You think the issue is important
- You want to show support for the reporter
      `,
      'add-comments': `
# Adding Comments

Participate in issue discussions through comments:

## Creating Comments
1. Navigate to any issue detail page
2. Scroll to the comment section
3. Type your message in the text area
4. Click "Add Comment" to submit

## Comment Features
- **Rich Text**: Format your comments with line breaks
- **File Attachments**: Upload files with your comments
- **Image Pasting**: Paste screenshots directly
- **Real-time Updates**: Comments appear instantly
- **Emoji Support**: Use emoji picker for expressions
      `,
      'attachments': `
# File Attachments

Share files and images to provide better context:

## Supported Files
- Images: PNG, JPG, JPEG, GIF
- Documents: PDF, DOC, DOCX, TXT
- Archives: ZIP (check admin settings for full list)

## Adding Attachments
- **Upload Button**: Click attachment button and select files
- **Drag & Drop**: Drag files directly onto the form
- **Paste Images**: Paste screenshots from clipboard

## File Security
- Files are stored securely in AWS S3
- Access controls and permissions
- File type validation and size limits
      `,
      'notifications': `
# Notifications

Stay informed about issue updates through multiple channels:

## WebEx Notifications
- Direct messages for followed issues
- Adaptive cards with issue details
- Links to view full conversations
- Instant delivery when comments are added

## Real-time Updates
- Live updates in the web interface
- Server-sent events for instant changes
- No page refresh needed
- Status changes appear immediately
      `,
      'webex-integration': `
# WebEx Integration

Seamless team communication with comprehensive WebEx features:

## Integration Features
${features['WebEx Integration']?.map(f => `- **${f.name}**: ${f.description}`).join('\n') || ''}

## Notification Types
- **New Issue Cards**: Adaptive cards posted to team rooms
- **Direct Messages**: Personal notifications for followed issues
- **Status Updates**: Real-time status change notifications
- **Weekly Analytics**: Comprehensive reports sent to administrators

## Setup Requirements
- WebEx bot token configuration
- Room ID setup for team notifications
- User email synchronization
- Proper permissions and access controls
      `,
      'real-time-updates': `
# Real-time Features

Live updates and instant notifications keep everyone synchronized:

## Server-Sent Events (SSE)
- Live updates for all issues on homepage
- Real-time updates for specific issue pages
- Automatic reconnection on connection loss
- Connection health monitoring

## Real-time Notifications
- Issue updates and status changes
- New comments with audio alerts
- Live upvote count updates
- Browser tab flashing when page not visible
      `,
      'following-system': `
# Following & Notifications

Advanced following system with comprehensive notification management:

## Auto-following
- Automatically follow issues you create
- Automatically follow issues you comment on
- Smart notification preferences

## Manual Following
- Follow any issue with one click
- Unfollow to stop notifications
- Following status visible on each issue

## Notification Delivery
- WebEx direct messages
- Real-time web notifications
- Email notifications (if configured)
      `,
      'user-management': `
# User Management

Administrators can manage users and their access:

## Adding Users
1. Go to Admin → User Management
2. Click "Add User" button
3. Fill in user details (name, email, role)
4. Set authentication method
5. Save to create the account

## User Roles
- **User**: Standard access to create and manage issues
- **Admin**: Full system access including settings and user management

## Authentication Methods
- **SAML SSO**: Enterprise single sign-on
- **Local**: Username/password authentication
- **WebEx Sync**: Automatically synced from WebEx
      `,
      'settings': `
# System Settings

Configure the application to meet your organization's needs:

## General Settings
- **Application Name**: Customize the system title
- **File Upload Limits**: Set maximum file sizes
- **Allowed File Types**: Configure permitted file extensions
- **Auto-close Settings**: Automatically close resolved issues

## Integration Settings
- **WebEx Configuration**: Set up team messaging
- **Email Settings**: Configure SMTP for notifications
- **Authentication**: Manage login methods
      `,
      'analytics': `
# Analytics & Reporting

Comprehensive analytics and reporting capabilities:

## System Analytics
${features['System Administration']?.filter(f => f.name.includes('Analytics') || f.name.includes('Report')).map(f => `- **${f.name}**: ${f.description}`).join('\n') || ''}

## Automated Features
${features['System Administration']?.filter(f => f.name.includes('Automated') || f.name.includes('Versioning')).map(f => `- **${f.name}**: ${f.description}`).join('\n') || ''}

## Weekly Reports
- Comprehensive system statistics
- Issue trends and patterns
- User activity summaries
- Performance metrics and insights
      `,
      'automation': `
# Automation Features

Advanced automation capabilities for streamlined operations:

## Automated Versioning
${features['System Administration']?.filter(f => f.name.includes('Versioning') || f.name.includes('Release')).map(f => `- **${f.name}**: ${f.description}`).join('\n') || ''}

## Deployment Integration
- Post-deployment processing with App Runner
- Automatic feature detection and tracking
- Semantic version determination
- Release notes generation

## Breaking Change Prevention
- Comprehensive feature inventory tracking
- Automated change detection
- Version impact analysis
- Safe deployment practices
      `
    };
  }

  static generateFAQ(features) {
    return [
      {
        question: 'How does the smart duplicate detection work?',
        answer: 'The system uses TF-IDF (Term Frequency-Inverse Document Frequency) with cosine similarity to analyze issue content and prevent duplicates. It compares your issue against existing ones and suggests similar issues before submission.'
      },
      {
        question: 'What real-time features are available?',
        answer: 'The system provides live updates using Server-Sent Events, instant WebEx notifications, real-time comment updates, live upvote counts, and automatic page refreshing when new content is available.'
      },
      {
        question: 'How does the following system work?',
        answer: 'You automatically follow issues you create or comment on. You can also manually follow any issue. Followers receive WebEx direct messages, email notifications, and real-time updates for all activity on followed issues.'
      },
      {
        question: 'What authentication methods are supported?',
        answer: 'The system supports SAML SSO for enterprise authentication, local username/password authentication, and automatic WebEx user synchronization. Administrators can configure the preferred method for their organization.'
      },
      {
        question: 'How does the automated versioning work?',
        answer: 'The system automatically detects feature changes by comparing the current feature inventory with the database baseline. It determines semantic version increments (major/minor/patch) and generates user-friendly release notes automatically.'
      },
      {
        question: 'What file types can I attach to issues?',
        answer: 'You can attach images (PNG, JPG, GIF), documents (PDF, DOC, TXT), archives (ZIP), and other file types as configured by administrators. Files are stored securely in AWS S3 with access controls.'
      },
      {
        question: 'How do WebEx notifications work?',
        answer: 'The system sends adaptive cards to team rooms for new issues and direct messages to users following specific issues. Notifications include rich formatting, action buttons, and links to view full conversations.'
      },
      {
        question: 'What admin features are available?',
        answer: 'Administrators have access to user management, system settings, WebEx integration configuration, weekly analytics reports, automated versioning controls, and comprehensive system administration tools.'
      }
    ];
  }

  static async updateHelpContent() {
    try {
      const helpContent = this.generateHelpContent();
      
      // Save to database for dynamic loading
      const { db } = await import('./dynamodb.js');
      await db.saveSetting('help_content', JSON.stringify(helpContent));
      
      console.log('✅ Help content updated successfully');
      return helpContent;
    } catch (error) {
      console.error('❌ Error updating help content:', error);
      throw error;
    }
  }
}