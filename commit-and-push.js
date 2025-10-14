#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { AutoTracker } from './auto-tracker.js';
import { SemanticVersioner } from './semantic-version.js';
import { ReleaseNotesUpdater } from './release-notes-updater.js';
import { ChangeAnalyzer } from './change-analyzer.js';
import { db } from './lib/dynamodb.js';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import readline from 'readline';
import yaml from 'js-yaml';

class CommitBuilder {
  static async generateCommits() {
    console.log('🔍 Analyzing changes...\n');
    
    // Use only AutoTracker with SemVer compliance
    const autoDetected = AutoTracker.autoTrackChanges();
    const commits = [];
    
    // Group changes by type
    const breaking = autoDetected.filter(c => c.type === 'breaking');
    const features = autoDetected.filter(c => c.type === 'features');
    const fixes = autoDetected.filter(c => c.type === 'fixes');
    const other = autoDetected.filter(c => c.type === 'other');

    // Only create breaking change commit if there are actual breaking changes
    if (breaking.length > 0) {
      commits.push({
        type: 'feat!',
        description: this.buildDetailedDescription(breaking, 'breaking'),
        body: await this.buildDetailedBody(breaking),
        versionImpact: 'MAJOR'
      });
    }

    if (features.length > 0) {
      commits.push({
        type: 'feat',
        description: this.buildDetailedDescription(features, 'features'),
        body: await this.buildDetailedBody(features),
        versionImpact: 'MINOR'
      });
    }

    if (fixes.length > 0) {
      commits.push({
        type: 'fix',
        description: this.buildDetailedDescription(fixes, 'fixes'),
        body: await this.buildDetailedBody(fixes),
        versionImpact: 'PATCH'
      });
    }

    if (other.length > 0) {
      commits.push({
        type: 'fix',
        description: this.buildDetailedDescription(other, 'other'),
        body: await this.buildDetailedBody(other),
        versionImpact: 'PATCH'
      });
    }

    return commits;
  }

  static buildBreakingDescription(changes) {
    if (changes.length === 1) {
      const desc = changes[0].description;
      if (!desc.match(/^(implement|introduce|change|modify|remove|deprecate)/i)) {
        return `implement ${desc}`;
      }
      return desc;
    }
    return `implement ${changes.length} breaking changes`;
  }

  static buildFeatureDescription(changes) {
    if (changes.length === 1) {
      const desc = changes[0].description;
      if (!desc.match(/^(add|implement|create|introduce|enhance|improve)/i)) {
        return `add ${desc}`;
      }
      return desc;
    }
    return `add ${changes.length} new features`;
  }

  static buildFixDescription(fixes) {
    if (fixes.length === 1) {
      // Ensure fix descriptions start with action verbs
      const desc = fixes[0].description;
      if (!desc.match(/^(fix|resolve|correct|patch|repair|address)/i)) {
        return `fix ${desc}`;
      }
      return desc;
    }
    return `resolve ${fixes.length} issues`;
  }

  static buildAutoDescription(changes) {
    const components = changes.filter(c => c.file.includes('components/')).length;
    const apis = changes.filter(c => c.file.includes('/api/')).length;
    const pages = changes.filter(c => c.file.includes('page.js')).length;

    const parts = [];
    if (components > 0) parts.push(`${components} UI component${components > 1 ? 's' : ''}`);
    if (apis > 0) parts.push(`${apis} API endpoint${apis > 1 ? 's' : ''}`);
    if (pages > 0) parts.push(`${pages} page${pages > 1 ? 's' : ''}`);

    return `enhance ${parts.join(', ')}`;
  }

  static buildOtherDescription(changes) {
    if (changes.length === 1) {
      return changes[0].description;
    }
    return `update ${changes.length} system components`;
  }

  static buildBreakingBody(changes) {
    const body = changes.map(c => `- ${c.description}`).join('\n');
    return `${body}\n\nBREAKING CHANGE: ${changes[0].details.breakingReason || 'API or functionality changes require user action'}`;
  }

  static buildFeatureBody(changes) {
    return changes.map(c => `- ${c.description}`).join('\n');
  }

  static buildFixBody(fixes) {
    return fixes.map(f => `- ${f.description}`).join('\n');
  }

  static buildAutoBody(changes) {
    return changes.map(c => `- ${c.description}`).join('\n');
  }

  static buildOtherBody(changes) {
    return changes.map(c => `- ${c.description}`).join('\n');
  }
  
  static buildDetailedDescription(changes, type) {
    if (changes.length === 1) {
      return this.humanizeDescription(changes[0].description);
    }
    
    // For multiple changes, create a meaningful summary
    const typeMap = {
      'breaking': 'implement breaking changes',
      'features': 'enhance system with new features', 
      'fixes': 'resolve multiple issues',
      'other': 'update system components'
    };
    
    return `${typeMap[type]} (${changes.length} changes)`;
  }
  
  static async buildDetailedBody(changes) {
    const uniqueDetails = new Set();
    
    for (const change of changes) {
      if (change.specificDescription) {
        uniqueDetails.add(`- ${change.specificDescription}`);
      } else if (change.details) {
        uniqueDetails.add(`- ${change.details}`);
      } else {
        // Use ChangeAnalyzer for real-time analysis
        const specificDesc = ChangeAnalyzer.analyzeChange(change.file || change.description);
        uniqueDetails.add(`- ${specificDesc}`);
      }
    }
    
    return Array.from(uniqueDetails).join('\n');
  }
  
  static async analyzeGitDiff(filePath) {
    try {
      // Check if file exists first
      if (!existsSync(filePath)) {
        return `Removed ${filePath.split('/').pop().replace('.js', '').replace('-', ' ')} file`;
      }
      
      // Get the actual diff for staged changes
      const diff = execSync(`git diff --cached "${filePath}" || git diff "${filePath}"`, { 
        encoding: 'utf8', 
        stdio: 'pipe' 
      });
      
      if (!diff) {
        return await this.getEnhancedDescription(filePath);
      }
      
      return this.interpretDiffForUsers(diff, filePath);
      
    } catch (error) {
      // Handle deleted files or other git errors
      if (error.message.includes('unknown revision or path not in the working tree')) {
        return `Removed ${filePath.split('/').pop().replace('.js', '').replace('-', ' ')} temporary file`;
      }
      // Fallback to enhanced description if git diff fails
      return await this.getEnhancedDescription(filePath);
    }
  }
  
  static interpretDiffForUsers(diff, filePath) {
    const addedLines = diff.split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++'));
    const removedLines = diff.split('\n').filter(line => line.startsWith('-') && !line.startsWith('---'));
    
    // Analyze what was actually changed
    const changes = {
      envVars: false,
      authentication: false,
      database: false,
      ui: false,
      email: false,
      security: false,
      configuration: false,
      errorHandling: false,
      validation: false
    };
    
    const allChanges = [...addedLines, ...removedLines].join(' ').toLowerCase();
    
    // Detect types of changes
    if (allChanges.includes('process.env') || allChanges.includes('ssm') || allChanges.includes('nextauth_url')) {
      changes.envVars = true;
    }
    if (allChanges.includes('saml') || allChanges.includes('sso') || allChanges.includes('auth')) {
      changes.authentication = true;
    }
    if (allChanges.includes('dynamodb') || allChanges.includes('database') || allChanges.includes('db.')) {
      changes.database = true;
    }
    if (allChanges.includes('smtp') || allChanges.includes('email') || allChanges.includes('nodemailer')) {
      changes.email = true;
    }
    if (allChanges.includes('error') || allChanges.includes('catch') || allChanges.includes('try')) {
      changes.errorHandling = true;
    }
    if (allChanges.includes('validation') || allChanges.includes('validate') || allChanges.includes('verify')) {
      changes.validation = true;
    }
    if (allChanges.includes('className') || allChanges.includes('jsx') || allChanges.includes('component')) {
      changes.ui = true;
    }
    if (allChanges.includes('secure') || allChanges.includes('encrypt') || allChanges.includes('password')) {
      changes.security = true;
    }
    if (allChanges.includes('config') || allChanges.includes('apprunner') || allChanges.includes('yaml')) {
      changes.configuration = true;
    }
    
    // Generate user-friendly description based on file and changes
    return this.generateUserFriendlyDescription(filePath, changes, addedLines.length, removedLines.length);
  }
  
  static generateUserFriendlyDescription(filePath, changes, added, removed) {
    const fileName = filePath.split('/').pop() || filePath;
    const fullPath = filePath.toLowerCase();
    
    // Enhanced file-specific descriptions with UI/UX context - use full path for accuracy
    if (fullPath.includes('admin') && fullPath.includes('settings') && fileName === 'page.js') {
      if (changes.ui && added > 5) {
        return 'Enhanced admin settings interface with improved Webex configuration display';
      }
      return 'Fixed admin settings page to properly display Webex configuration from SSM parameters';
    }
    
    if (fullPath.includes('admin') && fileName.includes('page')) {
      if (changes.ui && added > 10) {
        return 'Redesigned admin dashboard with modern colorful design and improved visual layout';
      }
      if (changes.ui) {
        return 'Enhanced admin interface with better organization and user experience';
      }
      if (changes.email) {
        return 'Improved admin settings page for easier email configuration';
      }
      return 'Updated admin settings page with improved functionality';
    }
    
    if (fileName.includes('settings') && fileName.includes('page')) {
      if (changes.ui && added > 5) {
        return 'Enhanced settings interface with tabbed organization and individual save buttons';
      }
      return 'Reorganized settings with better tab structure and consolidated user management';
    }
    
    if (fileName.includes('users') && fileName.includes('page')) {
      return 'Moved user management into settings for better organization and easier access';
    }
    
    if (fileName.includes('change-password')) {
      return 'Added password change feature for users to update their own passwords from profile menu';
    }
    
    if (fileName.includes('Navbar')) {
      if (changes.ui) {
        return 'Enhanced navigation bar with improved user menu and password change functionality';
      }
      return 'Updated navigation component with better user experience';
    }
    
    if (fileName.includes('welcome-user') && fileName.includes('route')) {
      if (changes.ui || added > 20) {
        return 'Redesigned welcome emails with modern, professional templates for better user onboarding';
      }
      return 'Enhanced welcome email system with improved templates and messaging';
    }
    
    if (fileName.includes('email')) {
      if (changes.security) {
        return 'Enhanced email system security by storing credentials more safely';
      }
      if (changes.validation) {
        return 'Improved email testing with better connection validation';
      }
      return 'Enhanced email functionality for better reliability';
    }
    
    if (fileName.includes('release-plugin')) {
      if (changes.errorHandling || added > 10) {
        return 'Improved release notes to provide more specific and meaningful descriptions of changes';
      }
      return 'Enhanced the automated release system for better reliability';
    }
    
    if (fileName.includes('breadcrumb') || (fileName.includes('issue') && changes.ui)) {
      return 'Fixed navigation breadcrumbs to show correct path based on where you came from';
    }
    
    if (fileName.includes('saml') || fileName.includes('sso')) {
      if (changes.authentication) {
        return 'Improved single sign-on system for easier and more secure login';
      }
      if (changes.errorHandling) {
        return 'Enhanced login system with better error messages and troubleshooting';
      }
      return 'Updated authentication system for improved security and reliability';
    }
    
    if (fileName.includes('apprunner') || fileName.includes('.yaml')) {
      if (changes.envVars) {
        return 'Updated deployment configuration to use secure credential storage';
      }
      return 'Enhanced deployment configuration for better system reliability';
    }
    
    if (fileName.includes('package.json')) {
      return 'Updated project configuration to support new features and improvements';
    }
    
    // Enhanced generic descriptions based on change types
    if (changes.ui && added > 5) {
      return `Redesigned ${fileName.replace('.js', '').replace('-', ' ')} interface with modern visual improvements`;
    }
    if (changes.security) {
      return `Enhanced security measures in ${fileName.replace('.js', '').replace('-', ' ')} system`;
    }
    if (changes.errorHandling) {
      return `Improved error handling and user feedback in ${fileName.replace('.js', '').replace('-', ' ')} feature`;
    }
    if (changes.validation) {
      return `Added better validation and verification to ${fileName.replace('.js', '').replace('-', ' ')} functionality`;
    }
    if (changes.ui) {
      return `Enhanced user interface and experience for ${fileName.replace('.js', '').replace('-', ' ')} feature`;
    }
    
    // Enhanced fallback based on change volume and context
    if (added > removed && added > 10) {
      return `Added significant new functionality to ${fileName.replace('.js', '').replace('-', ' ')} system`;
    } else if (added > removed) {
      return `Enhanced ${fileName.replace('.js', '').replace('-', ' ')} system with new features`;
    } else if (removed > added) {
      return `Simplified and optimized ${fileName.replace('.js', '').replace('-', ' ')} system`;
    } else {
      return `Improved ${fileName.replace('.js', '').replace('-', ' ')} system for better performance`;
    }
  }
  
  static async getEnhancedDescription(filePath) {
    const fileName = filePath.split('/').pop() || filePath;
    
    // First try to get description from feature database
    try {
      const { db } = await import('./lib/dynamodb.js');
      const allFeatures = await db.getAllFeatures();
      
      // Find matching feature by file path or name
      const matchingFeature = allFeatures.find(feature => 
        feature.filePath === filePath || 
        feature.filePath === fileName ||
        feature.name.toLowerCase().includes(fileName.replace('.js', '').replace('-', ' '))
      );
      
      if (matchingFeature) {
        return `Enhanced ${matchingFeature.name}: ${matchingFeature.description}`;
      }
    } catch (error) {
      // Continue with manual patterns if database lookup fails
    }
    
    // Manual patterns for specific files
    const patterns = {
      'mandatory-check': 'Enhanced Breaking Change Prevention Protocol with database-driven feature tracking and automated compliance enforcement',
      'enhanced-bcpp': 'Implemented comprehensive BCPP system with automatic feature detection and breaking change risk analysis',
      'comprehensive-catalog': 'Created comprehensive feature cataloging system to scan and track all codebase features in database',
      'create-baseline': 'Established baseline feature inventory with core application features for BCPP tracking',
      'initialize-feature-baseline': 'Built automated feature baseline initialization system for comprehensive codebase scanning',
      'commit-and-push': 'Enhanced automated versioning system with mandatory BCPP integration and specific release notes generation',
      'events': 'Fixed Server-Sent Events endpoint to prevent incomplete chunked encoding errors and improve real-time connection stability',
      'webex': 'Updated Webex settings API to save configuration to SSM parameters for persistence across App Runner deployments',
      'release-notes': 'Enhanced release notes system with user session management and timezone-aware timestamp display',
      'timezone': 'Added timezone API endpoint to provide DEFAULT_TIMEZONE environment variable to frontend components',
      'releases': 'Enhanced releases API with comprehensive timestamp support and database query optimization',
      'dynamodb': 'Enhanced database service with comprehensive feature tracking and timestamp field support',
      'apprunner': 'Updated deployment configuration for enhanced BCPP system and automated feature tracking',
      'Navbar': 'Fixed navbar component to maintain consistent container alignment with table layouts across all pages',
      'page': 'Enhanced page components with improved user session management and timezone-aware functionality',
      'route': 'Enhanced API endpoints with comprehensive error handling and SSM parameter integration',
      'admin': 'Fixed admin settings page to use SSM-based Webex configuration instead of local environment files',
      'settings': 'Enhanced settings management with proper SSM parameter storage for App Runner compatibility',
      'webex-check': 'Added Webex notification enablement check using database settings for proper integration flow',
      'lib': 'Enhanced library services with comprehensive debugging and error handling for production reliability',
      'enhanced-bcpp': 'Implemented automated pattern generation system for comprehensive breaking change prevention',
      'comprehensive': 'Created comprehensive feature cataloging system for complete codebase visibility and tracking',
      'baseline': 'Established feature baseline initialization for complete BCPP system integration',
      'catalog': 'Built automated feature detection and cataloging system for database-driven tracking',
      'samlconfig': 'Fixed SAML metadata parsing to properly extract SSO URLs and certificates from Duo XML',
      'saml': 'Fixed SAML login URL generation by correcting metadata storage and parsing logic',
      'auto-tracker': 'Fixed commit analysis system to correctly identify file paths and prevent misclassification of changes',
      'layout': 'Improved Root Page with better user experience and session management',
      's3': 'Enhanced s3 Service with improved functionality and error handling',
      'ewsclient': 'Enhanced ews-client Service with improved functionality and error handling',
      'ntlmauth': 'Enhanced ntlm-auth Service with improved functionality and error handling',
      'auth': 'Enhanced auth Service with improved functionality and error handling',
          'emailprocessor': 'Enhanced email-processor Service with improved functionality and error handling',
          'emailservice': 'Enhanced email-service Service with improved functionality and error handling',
          'helpgenerator': 'Enhanced help-generator Service with improved functionality and error handling',
          'csrf': 'Enhanced csrf Service with improved functionality and error handling',
          'authcheck': 'Enhanced auth-check Service with improved functionality and error handling',
          'automapping-utility': 'Enhanced auto-mapping-utility Service with improved functionality and error handling',
          'saemail-service': 'Enhanced sa-email-service Service with improved functionality and error handling',
          'sawebex-service': 'Enhanced sa-webex-service Service with improved functionality and error handling',
          'webexsync': 'Enhanced webex-sync Service with improved functionality and error handling',
          'saauto-assignment': 'Enhanced sa-auto-assignment Service with improved functionality and error handling',
          'practiceextractor': 'Enhanced practice-extractor Service with improved functionality and error handling',
          'practicematcher': 'Enhanced practice-matcher Service with improved functionality and error handling',
          'sanitize': 'Enhanced sanitize Service with improved functionality and error handling',
          'webexservice': 'Enhanced webex-service Service with improved functionality and error handling',
          'authhandler': 'Enhanced auth-handler Service with improved functionality and error handling',
          'etatracker': 'Enhanced eta-tracker Service with improved functionality and error handling',
          'assignmentemail-processor': 'Enhanced assignment-email-processor Service with improved functionality and error handling',
    };
    
    // Check for pattern matches
    for (const [pattern, description] of Object.entries(patterns)) {
      if (fileName.includes(pattern)) {
        return description;
      }
    }
    
    // Try git diff analysis
    try {
      const diff = execSync(`git diff HEAD~1 "${filePath}" || git diff --cached "${filePath}" || echo ""`, { 
        encoding: 'utf8', 
        stdio: 'pipe' 
      });
      
      if (diff) {
        return this.analyzeSpecificChanges(diff, fileName);
      }
    } catch (error) {
      // Continue with automated generation
    }
    
    // Automated description generation based on file type and name
    return this.generateAutomatedDescription(fileName, filePath);
  }
  
  static generateAutomatedDescription(fileName, filePath) {
    const cleanName = fileName.replace('.js', '').replace('-', ' ').replace('_', ' ');
    
    // Specific handling for SidebarLayout changes
    if (fileName.includes('SidebarLayout') || fileName.includes('sidebarlayout')) {
      // Check if this is a menu addition by reading the file content
      try {
        const content = readFileSync(filePath, 'utf8');
        if (content.includes('Practice Information') && content.includes('practice-information')) {
          return 'Added Practice Information menu item to sidebar navigation between Dashboard and Practice Issues';
        }
      } catch (error) {
        // File read error, use generic description
      }
      return 'Updated sidebar navigation layout and menu structure';
    }
    
    if (filePath.includes('/api/')) {
      return `Enhanced ${cleanName} API endpoint with improved functionality and error handling`;
    }
    if (filePath.includes('/components/')) {
      return `Updated ${cleanName} component with enhanced user interface and functionality`;
    }
    if (filePath.includes('page.js')) {
      return `Improved ${cleanName} page with better user experience and functionality`;
    }
    if (filePath.includes('/lib/')) {
      return `Enhanced ${cleanName} service with improved functionality and reliability`;
    }
    if (fileName.includes('.yaml') || fileName.includes('.yml')) {
      return `Updated ${cleanName} configuration for improved system deployment and functionality`;
    }
    if (fileName.includes('.json')) {
      return `Updated ${cleanName} configuration with enhanced settings and dependencies`;
    }
    
    return `Enhanced ${cleanName} system with improved functionality and reliability`;
  }
  
  static analyzeSpecificChanges(diff, fileName) {
    const addedLines = diff.split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++'));
    const removedLines = diff.split('\n').filter(line => line.startsWith('-') && !line.startsWith('---'));
    
    // Look for specific patterns in the diff
    const allChanges = [...addedLines, ...removedLines].join(' ').toLowerCase();
    
    // SSE/Events fixes
    if (allChanges.includes('controller.desiredsize') || allChanges.includes('err_incomplete_chunked')) {
      return 'Fixed Server-Sent Events connection stability by adding controller state validation and better error handling';
    }
    if (allChanges.includes('heartbeat') && allChanges.includes('20000')) {
      return 'Improved SSE heartbeat timing and connection management to prevent timeout errors';
    }
    if (allChanges.includes('transfer-encoding') && allChanges.includes('chunked')) {
      return 'Removed conflicting Transfer-Encoding header to fix incomplete chunked encoding errors in SSE streams';
    }
    
    // Release notes enforcement
    if (allChanges.includes('throw new error') && allChanges.includes('specific')) {
      return 'Enhanced release notes system to enforce specific descriptions and fail when generic patterns are detected';
    }
    if (allChanges.includes('validatereleasenotes') && allChanges.includes('specificity')) {
      return 'Added validation system to prevent generic release notes and ensure all changes have specific descriptions';
    }
    
    // Webex settings fixes
    if (allChanges.includes('ssmclient') && allChanges.includes('webex')) {
      return 'Fixed Webex settings to save to SSM parameters instead of database for persistence across App Runner deployments';
    }
    if (allChanges.includes('putparametercommand') && allChanges.includes('webex_scoop')) {
      return 'Updated Webex configuration to use environment-specific SSM parameters for proper dev/prod isolation';
    }
    
    // Breadcrumb fixes
    if (allChanges.includes('breadcrumb') && allChanges.includes('home')) {
      return 'Fixed duplicate Home links in breadcrumb navigation by removing redundant breadcrumb items';
    }
    
    // Environment detection fixes
    if (allChanges.includes('environment') && (allChanges.includes('node_env') || allChanges.includes('single source'))) {
      return 'Fixed environment detection to use ENVIRONMENT variable from apprunner.yaml as single source of truth for proper dev/prod targeting';
    }
    
    // Version API fixes
    if (allChanges.includes('current_version') && allChanges.includes('setting')) {
      return 'Fixed version display in navbar by updating current_version setting when new releases are created';
    }
    
    // Release notes page fixes
    if (fileName.includes('page.js') && allChanges.includes('release')) {
      return 'Fixed release notes page breadcrumb navigation to remove duplicate Home links';
    }
    
    // API route fixes
    if (fileName.includes('route.js') && allChanges.includes('ssm')) {
      return 'Enhanced settings API to use SSM parameters for persistent configuration across deployments';
    }
    
    // Previous patterns
    if (allChanges.includes('class semanticversioner')) {
      return 'Created new SemanticVersioner class with SemVer 2.0.0 compliance validation and database-driven version calculation';
    }
    if (allChanges.includes('releasenotesupdater')) {
      return 'Built ReleaseNotesUpdater class that generates modern release notes pages with sidebar navigation and responsive design';
    }
    if (allChanges.includes('validateSemVerCompliance')) {
      return 'Added comprehensive semantic versioning compliance validation with breaking change detection and version increment rules';
    }
    if (allChanges.includes('updateReleaseNotesPage')) {
      return 'Implemented automatic release notes page generation with industry-standard layout and version filtering';
    }
    if (allChanges.includes('local') && allChanges.includes('credentials')) {
      return 'Added support for local AWS credentials from .env.local file for commit script database access';
    }
    if (allChanges.includes('github actions') || allChanges.includes('semantic-release')) {
      return 'Removed GitHub Actions dependency by moving all versioning logic to local commit script for faster releases';
    }
    
    // Auto-tracker and commit system fixes
    if (fileName.includes('auto-tracker') && (allChanges.includes('fullpath') || allChanges.includes('admin/settings'))) {
      return 'Fixed commit analysis system to correctly identify file paths and prevent misclassification of changes';
    }
    if (fileName.includes('commit-and-push') && (allChanges.includes('generateuserfriendlydescription') || allChanges.includes('fullpath'))) {
      return 'Enhanced commit description generation to use accurate file path detection and prevent incorrect file identification';
    }
    
    // Debug logging patterns
    if (allChanges.includes('console.log') && allChanges.includes('debug')) {
      return 'Added comprehensive debug logging to track timestamp data flow and identify where timezone display issues occur';
    }
    if (allChanges.includes('debug:') && allChanges.includes('timestamp')) {
      return 'Enhanced debugging system to trace timestamp processing from database save through frontend display';
    }
    
    // No generic fallback - force specific descriptions
    throw new Error(`Unable to generate specific release notes for ${fileName}. Please add specific pattern matching for this change in analyzeSpecificChanges().`);
  }
  
  static validateReleaseNotesSpecificity(commits) {
    const errors = [];
    
    commits.forEach((commit, index) => {
      if (commit.body) {
        const bodyLines = commit.body.split('\n').filter(line => line.startsWith('- '));
        bodyLines.forEach(line => {
          if (line.includes('with improved functionality and user experience') ||
              line.includes('with X additions and Y changes') ||
              line.includes('Modified ') && line.includes(' with ') && line.includes(' additions and ') ||
              line.includes('Updated ') && line.includes(' file') ||
              line.includes('Enhanced ') && line.includes(' with improved') ||
              line.includes('system with improved functionality and reliability') ||
              line.includes('with enhanced functionality') ||
              line.includes('with improved functionality') ||
              line.includes('Enhanced ') && line.includes(' system with improved') ||
              line.includes('Updated ') && line.includes(' component with enhanced') ||
              line.includes('Improved ') && line.includes(' with better') && line.includes(' functionality') ||
              line.includes('service with improved functionality and reliability') ||
              line.includes('endpoint with improved functionality and error handling') ||
              line.includes('component with enhanced user interface and functionality') ||
              line.includes('Service with improved functionality and error handling') ||
              line.includes('system with improved functionality and reliability')) {
            errors.push(`Generic description detected in commit ${index + 1}: ${line}`);
          }
        });
      }
    });
    
    return errors;
  }

  static async showPreview(commits) {
    console.log('\n🔍 COMMIT & VERSION PREVIEW\n');
    
    // 1. Read environment from apprunner.yaml
    const environment = this.readEnvironmentFromAppRunner();
    console.log(`🌍 Environment: ${environment}`);
    
    // 2. Categorize changes
    const changeTypes = this.categorizeChanges(commits);
    console.log(`📊 Change Types: Breaking: ${changeTypes.breaking}, Features: ${changeTypes.features}, Fixes: ${changeTypes.fixes}`);
    
    // 3. Get current version from database
    const currentVersion = await SemanticVersioner.getCurrentVersion(environment);
    console.log(`📦 Current Version (${environment}): ${currentVersion}`);
    
    // 4. Calculate next version
    const nextVersion = await SemanticVersioner.calculateNextVersion(environment, changeTypes);
    console.log(`📦 Next Version: ${nextVersion}`);
    
    // 5. Validate SemVer compliance
    const complianceCheck = SemanticVersioner.validateSemVerCompliance(changeTypes, commits);
    const versionFormatCheck = SemanticVersioner.validateVersionFormat(nextVersion);
    const incrementCheck = SemanticVersioner.validateVersionIncrement(currentVersion, nextVersion, changeTypes);
    
    console.log(`📜 SemVer Compliance: ${complianceCheck.valid ? '✅ Valid' : '⚠️  Warnings'}`);
    if (!complianceCheck.valid) {
      complianceCheck.warnings.forEach(warning => {
        console.log(`   ⚠️  ${warning}`);
      });
    }
    
    if (!versionFormatCheck.valid) {
      console.log(`❌ Version Format Error: ${versionFormatCheck.error}`);
      process.exit(1);
    }
    
    if (!incrementCheck.valid) {
      console.log(`❌ Version Increment Error: ${incrementCheck.error}`);
      process.exit(1);
    }
    
    // 6. Validate release notes specificity
    const specificityErrors = this.validateReleaseNotesSpecificity(commits);
    if (specificityErrors.length > 0) {
      console.log('\n❌ RELEASE NOTES SPECIFICITY ERRORS:');
      specificityErrors.forEach(error => {
        console.log(`   ❌ ${error}`);
      });
      console.log('\n📝 Please update the git diff analysis to provide specific descriptions for these changes.');
      process.exit(1);
    }
    
    // 7. Generate release notes preview
    const releaseNotes = this.generateReleaseNotes(commits, nextVersion, changeTypes);
    console.log('\n📝 RELEASE NOTES PREVIEW:');
    console.log(releaseNotes);
    
    console.log('\n📋 PLANNED COMMITS:');
    commits.forEach((commit, index) => {
      console.log(`${index + 1}. [${commit.versionImpact}] ${commit.type}: ${commit.description}`);
    });
    
    return { nextVersion, releaseNotes, environment, changeTypes };
  }
  

  
  static humanizeDescription(description) {
    const humanizations = {
      // UI/UX improvements
      'redesign admin dashboard': 'Redesigned admin dashboard with modern colorful design and improved visual layout',
      'update admin dashboard': 'Enhanced admin dashboard with better visual design and improved functionality',
      'improve admin interface': 'Improved admin interface with better organization and user experience',
      'enhance settings page': 'Enhanced settings interface with tabbed organization and individual save buttons',
      'reorganize settings': 'Reorganized settings with better tab structure and consolidated user management',
      'move user management': 'Moved user management into settings for better organization and easier access',
      'redesign welcome email': 'Redesigned welcome emails with modern, professional templates for better user onboarding',
      'improve email template': 'Improved email templates with modern design and better formatting',
      'fix breadcrumb navigation': 'Fixed navigation breadcrumbs to show correct path based on where you came from',
      'add password change': 'Added password change feature for users to update their own passwords from profile menu',
      'fix release notes': 'Improved release notes to provide more specific and meaningful descriptions of changes',
      
      // Current changes - detailed user-friendly descriptions
      'enhance feature_inventory.md with new capabilities': 'Updated system documentation with comprehensive feature tracking and version history details',
      'implement breaking changes to semver-compliance': 'Enhanced version validation system with stricter compliance checking (may require developer review)',
      'update route maintenance and documentation': 'Improved version display system to show accurate release information',
      'update page maintenance and documentation': 'Enhanced release notes page to display corrected version history',
      'update auto-tracker maintenance and documentation': 'Refined automatic change detection for more accurate version classification',
      'update commit-and-push maintenance and documentation': 'Improved commit system reliability and user experience',
      'update navbar maintenance and documentation': 'Fixed navigation bar to display current version correctly',
      'update dynamodb maintenance and documentation': 'Enhanced database operations for better version tracking and data integrity',
      'update package.json maintenance and documentation': 'Updated project configuration to reflect current version status',
      
      // Legacy patterns
      'add new functionality to feature_inventory': 'Industry-Standard Semantic Versioning Compliance Documentation',
      'add new functionality to commit-and-push': 'Interactive Commit Approval System with GitHub Version Synchronization',
      'optimize database operations and queries': 'Enhanced Database Operations with SemVer Compliance Validation',
      'enhance navbar component': 'Updated Navigation Component with Version Display Improvements',
      'update application configuration': 'Application Configuration Updates for Enhanced Semantic Versioning',
      'enhance commit system': 'Interactive Commit Approval System with preview and user confirmation',
      'github sync': 'GitHub Version Synchronization to ensure accurate semantic versioning',
      'interactive approval': 'User Approval System for commits with detailed preview',
      'version sync': 'Enhanced Version Alignment between local and GitHub repositories',
      'commit preview': 'Comprehensive Commit Preview with release notes generation',
      'user approval': 'Interactive User Confirmation before any git operations',
      'breaking change prevention': 'Enhanced Breaking Change Prevention Protocol integration',
      'semver compliance': 'Semantic Versioning 2.0.0 Industry Standards Compliance'
    };
    
    const lowerDesc = description.toLowerCase();
    for (const [key, value] of Object.entries(humanizations)) {
      if (lowerDesc.includes(key)) {
        return value;
      }
    }
    
    // Context-aware improvements for common patterns
    if (description.includes('maintenance and documentation')) {
      if (description.includes('route')) return 'Improved version display system to show accurate release information';
      if (description.includes('page')) return 'Enhanced release notes page to display corrected version history';
      if (description.includes('navbar')) return 'Fixed navigation bar to display current version correctly';
      if (description.includes('dynamodb')) return 'Enhanced database operations for better version tracking and data integrity';
      if (description.includes('auto-tracker')) return 'Refined automatic change detection for more accurate version classification';
      if (description.includes('commit-and-push')) return 'Improved commit system reliability and user experience';
      return 'System maintenance updates to improve overall reliability and performance';
    }
    
    if (description.includes('breaking changes')) {
      return 'Enhanced system validation with stricter compliance checking (may require developer review)';
    }
    
    if (description.includes('new capabilities')) {
      return 'Updated system documentation with comprehensive feature tracking and version history details';
    }
    
    // Enhanced fallback with better context detection
    let humanized = description.charAt(0).toUpperCase() + description.slice(1).replace(/([a-z])([A-Z])/g, '$1 $2');
    
    // Add context based on common patterns
    if (lowerDesc.includes('fix') && !lowerDesc.includes('fixed')) {
      humanized = humanized.replace(/^Fix/, 'Fixed') + ' for improved reliability';
    } else if (lowerDesc.includes('add') && !lowerDesc.includes('added')) {
      humanized = humanized.replace(/^Add/, 'Added') + ' to enhance functionality';
    } else if (lowerDesc.includes('update') && !lowerDesc.includes('updated')) {
      humanized = humanized.replace(/^Update/, 'Updated') + ' with improved features';
    } else if (lowerDesc.includes('enhance') && !lowerDesc.includes('enhanced')) {
      humanized = humanized.replace(/^Enhance/, 'Enhanced') + ' for better user experience';
    }
    
    return humanized;
  }
  
  static async getUserApproval() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      rl.question('\n❓ Do you approve this version and release? (y/N): ', (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }

  static updateAppRunnerConfig() {
    // Get current branch
    const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    
    let sourceFile;
    if (branch === 'main') {
      sourceFile = 'apprunner-prod.yaml';
    } else {
      sourceFile = 'apprunner-dev.yaml';
    }
    
    try {
      console.log(`🔄 Updating apprunner.yaml from ${sourceFile}...`);
      copyFileSync(sourceFile, 'apprunner.yaml');
      console.log('✅ apprunner.yaml updated successfully');
    } catch (error) {
      console.error(`❌ Failed to update apprunner.yaml: ${error.message}`);
      process.exit(1);
    }
  }
  
  static readEnvironmentFromAppRunner() {
    try {
      const apprunnerContent = readFileSync('apprunner.yaml', 'utf8');
      const config = yaml.load(apprunnerContent);
      
      const envVars = config.run?.env || [];
      const environmentVar = envVars.find(env => env.name === 'ENVIRONMENT');
      
      return environmentVar?.value || 'dev';
    } catch (error) {
      console.error('Error reading environment from apprunner.yaml:', error);
      return 'dev';
    }
  }
  
  static categorizeChanges(commits) {
    return {
      breaking: commits.some(c => c.versionImpact === 'MAJOR'),
      features: commits.some(c => c.versionImpact === 'MINOR'),
      fixes: commits.some(c => c.versionImpact === 'PATCH')
    };
  }
  
  static generateReleaseNotes(commits, version, changeTypes) {
    const releaseType = SemanticVersioner.determineReleaseType(changeTypes);
    const date = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    let notes = `# 🎉 Version ${version}\n\n`;
    
    if (changeTypes.breaking) {
      notes += `## 🚀 Major Update\n\nSignificant changes that enhance your experience with Issues Tracker.\n\n`;
    } else if (changeTypes.features) {
      notes += `## ✨ Feature Update\n\nNew features and enhancements to make Issues Tracker even better.\n\n`;
    } else {
      notes += `## 🔧 Maintenance Update\n\nBug fixes and improvements to keep everything running smoothly.\n\n`;
    }
    
    // Add categorized changes with detailed descriptions from commit bodies
    const breaking = commits.filter(c => c.versionImpact === 'MAJOR');
    const features = commits.filter(c => c.versionImpact === 'MINOR');
    const fixes = commits.filter(c => c.versionImpact === 'PATCH');
    
    if (breaking.length > 0) {
      notes += `### 🚨 Breaking Changes\n\n`;
      breaking.forEach(commit => {
        if (commit.body) {
          const bodyLines = commit.body.split('\n').filter(line => line.startsWith('- '));
          if (bodyLines.length > 0) {
            bodyLines.forEach(line => {
              notes += `${line}\n`;
            });
          } else {
            notes += `- ${this.humanizeDescription(commit.description)}\n`;
          }
        } else {
          notes += `- ${this.humanizeDescription(commit.description)}\n`;
        }
      });
      notes += '\n';
    }
    
    if (features.length > 0) {
      notes += `### ✨ New Features\n\n`;
      features.forEach(commit => {
        if (commit.body) {
          const bodyLines = commit.body.split('\n').filter(line => line.startsWith('- '));
          if (bodyLines.length > 0) {
            bodyLines.forEach(line => {
              notes += `${line}\n`;
            });
          } else {
            notes += `- ${this.humanizeDescription(commit.description)}\n`;
          }
        } else {
          notes += `- ${this.humanizeDescription(commit.description)}\n`;
        }
      });
      notes += '\n';
    }
    
    if (fixes.length > 0) {
      notes += `### 🐛 Bug Fixes\n\n`;
      fixes.forEach(commit => {
        if (commit.body) {
          const bodyLines = commit.body.split('\n').filter(line => line.startsWith('- '));
          if (bodyLines.length > 0) {
            bodyLines.forEach(line => {
              notes += `${line}\n`;
            });
          } else {
            notes += `- ${this.humanizeDescription(commit.description)}\n`;
          }
        } else {
          notes += `- ${this.humanizeDescription(commit.description)}\n`;
        }
      });
      notes += '\n';
    }
    
    notes += `---\n\n**📅 Released:** ${date}\n**📦 Version:** ${version}\n\n*Thank you for using Issues Tracker! 🙏*`;
    
    return notes;
  }


}

// Main execution
async function main() {
  // MANDATORY: Run BCPP before any operations
  const { enforceBCPP } = await import('./enhanced-bcpp.js');
  await enforceBCPP();
  
  console.log('🚀 SIMPLIFIED LOCAL VERSIONING SYSTEM\n');
  console.log('ℹ️  All versioning and release notes handled locally - no GitHub Actions needed\n');

  // Step 1: Update apprunner.yaml based on current branch
  CommitBuilder.updateAppRunnerConfig();
  
  // Step 2: Auto-detect changes
  console.log('🔍 Auto-detecting changes...');
  const autoDetected = AutoTracker.autoTrackChanges();
  
  if (autoDetected.length > 0) {
    console.log(`✅ Auto-tracked ${autoDetected.length} changes`);
    autoDetected.forEach(change => {
      console.log(`   ${change.type}: ${change.description}`);
    });
    console.log('');
  }

  const commits = await CommitBuilder.generateCommits();

  if (commits.length === 0) {
    console.log('ℹ️  No changes detected or tracked.');
    process.exit(0);
  }

  // Step 3-6: Show preview with version calculation and release notes
  const { nextVersion, releaseNotes, environment, changeTypes } = await CommitBuilder.showPreview(commits);
  
  // Step 6: Get user approval
  const approved = await CommitBuilder.getUserApproval();
  
  if (!approved) {
    console.log('\n❌ Process cancelled by user.');
    console.log('📝 You can modify your changes and run the command again.');
    process.exit(0);
  }
  
  console.log('\n✅ Process approved. Proceeding...\n');
  
  try {
    // Step 7: Update database with new version
    console.log(`📊 Updating ${environment} database with version ${nextVersion}...`);
    const now = new Date();
    const release = {
      version: nextVersion,
      date: now.toISOString().split('T')[0],
      timestamp: now.toISOString(),
      type: SemanticVersioner.determineReleaseType(changeTypes),
      notes: releaseNotes,
      features: [],
      improvements: [],
      bugFixes: [],
      breaking: []
    };
    

    
    await db.saveRelease(release);
    
    // Update current version setting for the version API
    await db.saveSetting('current_version', nextVersion);
    console.log('✅ Database updated successfully');
    console.log(`✅ Current version setting updated to: ${nextVersion}`);
    
    // Step 7: Update release notes page
    console.log('📝 Updating release notes page...');
    const pageContent = await ReleaseNotesUpdater.updateReleaseNotesPage(environment, nextVersion, releaseNotes);
    writeFileSync('app/release-notes/page.js', pageContent);
    console.log('✅ Release notes page updated successfully');
    
    // Step 8: Commit everything and push
    console.log('\n📝 Creating single commit with all changes...');
    
    // Get all pending changes
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
    const allChanges = gitStatus.split('\n').filter(line => line.trim());
    
    console.log(`📁 Including ${allChanges.length} total changes:`);
    console.log('   - apprunner.yaml (environment config)');
    console.log('   - app/release-notes/page.js (updated release notes)');
    console.log(`   - ${allChanges.length - 2} other pending changes`);
    
    // Stage all changes
    execSync('git add .', { stdio: 'inherit' });
    
    // Create single commit
    const commitMessage = `release: ${nextVersion}\n\n${releaseNotes.split('\n').slice(0, 10).join('\n')}`;
    execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
    
    // Push to GitHub
    const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    execSync(`git push origin ${branch}`, { stdio: 'inherit' });
    
    console.log('\n✅ SUCCESS! New simplified versioning system completed:');
    console.log(`   📦 Version: ${nextVersion}`);
    console.log(`   🌍 Environment: ${environment}`);
    console.log(`   📊 Database: Updated`);
    console.log(`   📝 Release Notes: Updated`);
    console.log(`   🚀 Deployed: ${branch} branch`);
    
  } catch (error) {
    console.error('\n❌ Error during process:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);