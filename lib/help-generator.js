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
          { id: 'overview', title: 'System Overview', content: 'Learn about Practice Tools and its collaborative information management features.' },
          { id: 'first-login', title: 'First Time Login', content: 'Step-by-step guide for your first login and accessing practice boards.' },
          { id: 'navigation', title: 'Navigating the Interface', content: 'Understanding the main navigation, practice boards, and user interface elements.' }
        ]
      },
      'practice-information': {
        title: 'Practice Information',
        icon: '📊',
        articles: [
          { id: 'board-overview', title: 'Board Overview', content: 'Understanding practice boards, topics, and Kanban-style organization.' },
          { id: 'create-cards', title: 'Creating Cards', content: 'How to create and organize information cards with descriptions and attachments.' },
          { id: 'manage-columns', title: 'Managing Columns', content: 'Create, rename, and organize columns to match your workflow.' },
          { id: 'drag-drop', title: 'Moving Cards', content: 'Use drag-and-drop to move cards between columns and organize information.' },
          { id: 'topics', title: 'Topics & Organization', content: 'How topics help organize different areas within practice boards.' },
          { id: 'board-settings', title: 'Board Settings', content: 'Customize board backgrounds and visual appearance.' }
        ]
      },
      'practice-issues': {
        title: 'Practice Issues',
        icon: '📋',
        articles: [
          { id: 'issues-overview', title: 'Issues Overview', content: 'Understanding the practice issues module and its features.' },
          { id: 'leadership-view', title: 'Leadership View', content: 'Special features available to practice managers and principals.' }
        ]
      },
      'projects': {
        title: 'Projects',
        icon: '📁',
        articles: [
          { id: 'projects-overview', title: 'Projects Overview', content: 'Managing projects and resources within Practice Tools.' },
          { id: 'resource-assignments', title: 'Resource Assignments', content: 'How to manage project resource assignments and allocation.' }
        ]
      },
      'analytics': {
        title: 'Analytics',
        icon: '📈',
        articles: [
          { id: 'analytics-overview', title: 'Analytics Overview', content: 'View practice analytics and reports to track performance.' },
          { id: 'reports', title: 'Reports', content: 'Generate and interpret various practice reports and metrics.' }
        ]
      },
      'admin': {
        title: 'Administration',
        icon: '⚙️',
        articles: [
          { id: 'user-management', title: 'User Management', content: 'Managing users, roles, and practice assignments.' },
          { id: 'practice-setup', title: 'Practice Setup', content: 'Creating and configuring practice boards for different teams.' },
          { id: 'permissions-admin', title: 'Permission Management', content: 'Setting up role-based access control for practice teams.' },
          { id: 'system-settings', title: 'System Settings', content: 'Configure application settings and system preferences.' }
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

Practice Tools is a collaborative information management platform designed for practice teams with Kanban-style boards and real-time collaboration.

## Core Capabilities
- **Practice Boards**: Kanban-style boards for organizing practice information
- **Topics**: Multiple topics per practice for better organization
- **Real-time Collaboration**: Live updates and synchronization across team members
- **Role-based Access**: Granular permissions for different practice roles

## Key Features
- **Drag-and-Drop Interface**: Intuitive card movement between columns
- **Custom Backgrounds**: Personalize boards with themes and images
- **File Attachments**: Share supporting documents and images
- **Comments**: Team discussions on individual cards
- **Topic Preferences**: System remembers your preferred topics per practice
      `,
      'first-login': `
# First Time Login

Welcome to Practice Tools! Here's how to get started:

## Login Process
1. Navigate to the login page
2. Enter your credentials (email and password or use SAML SSO)
3. Click "Sign In" to access the system

## Initial Setup
- Review your profile information in the user dropdown
- Familiarize yourself with the main navigation
- Explore available practice boards

## Next Steps
- Select a practice board you have access to
- Explore the Main Topic to see existing content
- Create your first card or add comments to existing cards
- Try switching between different topics if available
      `,
      'navigation': `
# Navigating the Interface

Understanding the main interface elements will help you use Practice Tools effectively.

## Top Navigation
- **Logo**: Click to return to the practice boards
- **Practice Information**: Access your practice boards
- **Admin**: Access admin features (admin users only)
- **User Menu**: Access help, about, and logout options

## Practice Board Interface
- **Practice Selector**: Switch between different practice boards
- **Topic Selector**: Choose different topics within a practice
- **Board Settings**: Customize backgrounds and appearance (if permitted)
- **Columns**: Organize information in customizable workflow columns

## Card Management
- **Card Creation**: Add new information cards to columns
- **Card Details**: Click cards to view descriptions, comments, and attachments
- **Drag-and-Drop**: Move cards between columns to update status
- **Comments**: Collaborate with team members on specific cards
      `,
      'board-overview': `
# Board Overview

Practice boards use a Kanban-style layout to organize information:

## Board Structure
1. **Practice Boards**: Each practice has its own dedicated board
2. **Topics**: Multiple topics within each practice for organization
3. **Columns**: Customizable workflow columns (To Do, In Progress, Done, etc.)
4. **Cards**: Information items that can be moved between columns

## Key Concepts
- **Main Topic**: Protected default topic that cannot be renamed or deleted
- **Custom Topics**: Additional topics you can create, rename, and delete
- **Real-time Updates**: Changes appear instantly for all connected users
- **Drag-and-Drop**: Move cards between columns to update their status

## Getting Started
- Select a practice board from the dropdown
- Choose a topic to work with
- Create cards to organize information
- Use columns to represent different stages or categories
      `,
      'create-cards': `
# Creating Cards

Cards are the primary way to organize information on practice boards:

## Creating a New Card
1. Click "Add a card" button at the bottom of any column
2. Enter a descriptive title for the card
3. Add a detailed description (optional)
4. Click "Add Card" to create it

## Card Information
Each card displays:
- Title and description
- Creation date and author
- Number of comments and attachments
- Quick action buttons for editing and deleting

## Best Practices
- Use clear, descriptive titles
- Add detailed descriptions for complex items
- Attach relevant files and documents
- Use comments for team discussions
      `,
      'manage-columns': `
# Managing Columns

Columns help organize your workflow and information categories:

## Creating Columns
1. Click "Add another column" button on the right side of the board
2. Enter a descriptive column title
3. Click "Add Column" to create it

## Editing Columns
- **Rename**: Click on the column title to edit it inline
- **Delete**: Use the delete button (only if you created the column)
- **Reorder**: Columns maintain their creation order

## Column Best Practices
- Use workflow stages (To Do, In Progress, Done)
- Create category-based columns (Planning, Resources, Completed)
- Keep column names short and clear
- Limit the number of columns for better organization
      `,
      'drag-drop': `
# Moving Cards

Use drag-and-drop to organize and update card status:

## How to Move Cards
1. Click and hold on any card
2. Drag the card to the desired column
3. Release to drop the card in the new location
4. Changes are saved automatically and updated in real-time

## When to Move Cards
- Update status as work progresses
- Reorganize information by category
- Reflect changes in priority or workflow stage
- Collaborate with team members on organization

## Permissions
- Practice managers and principals can move any cards
- Practice members can move cards they created
- Admins have full access to move any cards
      `,
      'topics': `
# Topics & Organization

Topics help organize different areas within practice boards:

## Topic Concepts
1. **Main Topic**: Protected default topic that cannot be renamed or deleted
2. **Custom Topics**: Additional topics you can create, rename, and delete
3. **Topic-specific Content**: Each topic has its own cards and columns
4. **Shared Settings**: Board settings like backgrounds apply to all topics

## Managing Topics
- Click the "+" button next to the topic selector to add new topics
- Click the pencil icon to rename existing topics (except Main Topic)
- Click the trash icon to delete topics you no longer need
- Only practice managers, principals, and admins can manage topics

## Topic Preferences
- The system remembers your last selected topic for each practice board
- When you return to a practice board, it automatically loads your preferred topic
- Preferences are stored locally and maintained across sessions
      `,
      'board-settings': `
# Board Settings

Customize the appearance and behavior of your practice boards:

## Accessing Settings
1. Click the settings gear icon next to the practice board title
2. Settings panel opens with customization options
3. Changes apply to the entire practice board across all topics

## Background Options
- **Predefined Themes**: Choose from gradient backgrounds
- **Custom Images**: Upload your own background images
- **Default**: Clean, professional gray background

## Who Can Change Settings
- Practice managers and principals for their assigned practices
- Admins can modify any practice board settings
- Settings are shared across all topics within a practice
      `,
      'issues-overview': `
# Issues Overview

The Practice Issues module helps track and manage practice-related issues:

## Key Features
- Issue tracking and management
- Status updates and workflow
- Team collaboration on issue resolution
- Integration with practice information

## Access Levels
- All practice members can view issues for their assigned practices
- Practice managers and principals have additional management capabilities
- Leadership view provides enhanced oversight and reporting
      `,
      'leadership-view': `
# Leadership View

Special features available to practice managers and principals:

## Enhanced Capabilities
- Advanced issue management and oversight
- Practice-wide reporting and analytics
- Team performance insights
- Strategic planning tools

## Access Requirements
- Available to practice managers and principals
- Requires assignment to specific practices
- Provides elevated permissions for practice oversight
      `,
      'projects-overview': `
# Projects Overview

Managing projects and resources within Practice Tools:

## Project Management Features
- Project planning and tracking
- Resource allocation and management
- Timeline and milestone tracking
- Team collaboration on project deliverables

## Integration Benefits
- Connects with practice information boards
- Links to practice issues and analytics
- Provides comprehensive project visibility
      `,
      'resource-assignments': `
# Resource Assignments

How to manage project resource assignments and allocation:

## Assignment Process
- Allocate team members to specific projects
- Define roles and responsibilities
- Set time commitments and availability
- Track resource utilization across projects

## Management Tools
- Visual resource allocation dashboards
- Conflict detection and resolution
- Capacity planning and forecasting
- Performance tracking and reporting
      `,
      'analytics-overview': `
# Analytics Overview

View practice analytics and reports to track performance:

## Available Analytics
- Practice performance metrics
- Team productivity insights
- Project completion rates
- Resource utilization statistics

## Report Types
- Real-time dashboards
- Historical trend analysis
- Comparative practice reports
- Custom metric tracking

## Using Analytics
- Monitor practice health and performance
- Identify areas for improvement
- Track progress toward goals
- Make data-driven decisions
      `,
      'reports': `
# Reports

Generate and interpret various practice reports and metrics:

## Report Categories
- Practice performance summaries
- Individual and team productivity
- Project status and completion rates
- Resource allocation and utilization

## Report Generation
- Automated daily, weekly, and monthly reports
- Custom date range selection
- Export capabilities for external analysis
- Scheduled delivery to stakeholders

## Interpreting Data
- Key performance indicators (KPIs)
- Trend analysis and forecasting
- Benchmark comparisons
- Actionable insights and recommendations
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
        question: 'What are practice boards and how do they work?',
        answer: 'Practice boards are Kanban-style boards that help organize practice-specific information. Each practice has its own board with multiple topics, customizable columns, and cards that can be moved between columns to track progress or categorize information.'
      },
      {
        question: 'What is the difference between Main Topic and other topics?',
        answer: 'Main Topic is the protected default topic that cannot be renamed or deleted. It serves as the primary workspace for each practice. Additional topics can be created, renamed, and deleted to organize information by project, category, or any other criteria.'
      },
      {
        question: 'How do topic preferences work?',
        answer: 'The system remembers your last selected topic for each practice board. When you return to a practice board, it automatically loads the topic you were last working with, providing a personalized experience across different practices.'
      },
      {
        question: 'What permissions do different roles have?',
        answer: 'Admins have full access to all boards. Practice Managers and Principals can edit boards for their assigned practices. Practice Members can view and comment on boards for their practices but have limited editing rights. NetSync Employees have read-only access to all boards.'
      },
      {
        question: 'How does real-time collaboration work?',
        answer: 'The system uses Server-Sent Events to provide live updates across all connected users. When someone adds a card, moves it between columns, or adds a comment, the changes appear instantly for everyone viewing the same board without requiring page refreshes.'
      },
      {
        question: 'What file types can I attach to cards?',
        answer: 'You can attach images (PNG, JPG, GIF), documents (PDF, DOC, TXT), archives (ZIP), and other file types as configured by administrators. Files are stored securely in AWS S3 with proper access controls.'
      },
      {
        question: 'Can I customize the appearance of practice boards?',
        answer: 'Yes, practice managers, principals, and admins can customize board backgrounds. You can choose from predefined gradient themes or upload custom background images. These settings apply to the entire practice board across all topics.'
      },
      {
        question: 'How do I create and manage columns?',
        answer: 'Click "Add another column" to create new columns. You can rename columns by clicking on their titles and delete columns you created. Columns help organize your workflow - common examples include "To Do", "In Progress", and "Done".'
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