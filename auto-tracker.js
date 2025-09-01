import { ChangeTracker } from './change-tracker.js';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { SemVerStandards } from './semver-compliance.js';
import { CodeAnalysisEngine } from './code-analysis-engine.js';

export class AutoTracker {
  static autoTrackChanges() {
    const modifiedFiles = this.getModifiedFiles();
    const changes = [];

    modifiedFiles.forEach(file => {
      const changeType = this.determineChangeType(file);
      const description = this.generateDescription(file, changeType);
      
      if (description) {
        changes.push({ type: changeType, description, file });
      }
    });

    // Group and save changes
    changes.forEach(change => {
      ChangeTracker.addChange(change.type, change.description, { file: change.file });
    });

    return changes;
  }

  static getModifiedFiles() {
    try {
      const output = execSync('git diff --name-only HEAD', { encoding: 'utf8' });
      return output.trim().split('\n').filter(f => f && !f.includes('pending-changes.json'));
    } catch {
      return [];
    }
  }

  static determineChangeType(file) {
    // Use intelligent code analysis for accurate classification
    const analysis = CodeAnalysisEngine.analyzeCodeChanges(file);
    
    console.log(`🔍 Code Analysis for ${file}:`);
    console.log(`   Classification: ${analysis.type} (${(analysis.confidence * 100).toFixed(0)}% confidence)`);
    console.log(`   Reasoning: ${analysis.reasoning}`);
    
    switch (analysis.type) {
      case 'MAJOR': return 'breaking';
      case 'MINOR': return 'features';
      case 'PATCH': return 'fixes';
      case 'NONE': return 'other';
      default: return 'features';
    }
  }

  static isLikelyBreakingChange(file) {
    // Only detect ACTUAL breaking changes, not system improvements
    const fileName = file.toLowerCase();
    const breakingFilePatterns = [
      'breaking-change', 'migration-required', 'deprecated-removal'
    ];
    
    if (breakingFilePatterns.some(pattern => fileName.includes(pattern))) {
      return true;
    }

    try {
      const diff = execSync(`git diff HEAD -- "${file}"`, { encoding: 'utf8' });
      
      // Only TRUE breaking change patterns
      const breakingPatterns = [
        // API breaking changes - only actual removals/signature changes
        /remove.*endpoint.*breaking/i, /delete.*api.*breaking/i,
        /change.*api.*signature.*breaking/i,
        // Authentication breaking changes - only actual auth flow changes
        /remove.*auth.*method.*breaking/i, /change.*login.*flow.*breaking/i,
        // Database breaking changes - only schema breaking changes
        /drop.*column.*breaking/i, /remove.*table.*breaking/i,
        // Explicit breaking change markers
        /BREAKING.*CHANGE/i, /breaking.*change.*required/i
      ];

      return breakingPatterns.some(pattern => pattern.test(diff));
    } catch {
      return false;
    }
  }

  static isLikelyBugFix(file) {
    // Check filename for bug fix indicators
    const fileName = file.toLowerCase();
    const bugFixFilePatterns = [
      'fix', 'bug', 'patch', 'repair', 'resolve', 'correct',
      'error', 'issue', 'problem', 'hotfix', 'quickfix'
    ];
    
    if (bugFixFilePatterns.some(pattern => fileName.includes(pattern))) {
      return true;
    }

    try {
      const diff = execSync(`git diff HEAD -- "${file}"`, { encoding: 'utf8' });
      
      // Enhanced bug fix patterns in diff content
      const bugFixPatterns = [
        // Error handling
        /fix.*error/i, /resolve.*error/i, /catch.*error/i,
        // Issue resolution
        /resolve.*issue/i, /fix.*issue/i, /address.*issue/i,
        // Problem solving
        /correct.*problem/i, /solve.*problem/i, /fix.*problem/i,
        // Bug fixes
        /patch.*bug/i, /fix.*bug/i, /squash.*bug/i,
        // Function repairs
        /repair.*function/i, /fix.*function/i, /restore.*function/i,
        // Null/undefined fixes
        /fix.*null/i, /fix.*undefined/i, /handle.*null/i,
        // Validation fixes
        /fix.*validation/i, /correct.*validation/i,
        // Performance fixes
        /fix.*performance/i, /optimize.*slow/i, /resolve.*timeout/i,
        // UI/UX fixes
        /fix.*display/i, /correct.*layout/i, /resolve.*rendering/i,
        // Security fixes
        /fix.*security/i, /patch.*vulnerability/i, /secure.*endpoint/i,
        // Database fixes
        /fix.*query/i, /resolve.*connection/i, /correct.*schema/i,
        // API fixes
        /fix.*endpoint/i, /resolve.*response/i, /correct.*status/i
      ];

      return bugFixPatterns.some(pattern => pattern.test(diff));
    } catch {
      return false;
    }
  }

  static isLikelyFeature(file) {
    // Check filename for feature indicators
    const fileName = file.toLowerCase();
    const featureFilePatterns = [
      'feature', 'new', 'add', 'create', 'implement', 'enhance',
      'improve', 'upgrade', 'extend', 'expand'
    ];
    
    if (featureFilePatterns.some(pattern => fileName.includes(pattern))) {
      return true;
    }

    // Check file types that typically indicate features
    if (file.includes('/api/') || file.includes('components/') || 
        file.includes('page.js') || file.includes('hooks/') ||
        file.includes('lib/') || file.includes('utils/')) {
      
      try {
        const diff = execSync(`git diff HEAD -- "${file}"`, { encoding: 'utf8' });
        
        // Feature patterns in diff content
        const featurePatterns = [
          // New functionality
          /add.*feature/i, /implement.*feature/i, /create.*feature/i,
          /new.*functionality/i, /introduce.*capability/i,
          // Enhancements
          /enhance.*with/i, /improve.*by/i, /upgrade.*to/i,
          /extend.*functionality/i, /expand.*capabilities/i,
          // New components/pages
          /add.*component/i, /create.*page/i, /implement.*ui/i,
          /new.*interface/i, /add.*endpoint/i,
          // Integration features
          /integrate.*with/i, /connect.*to/i, /add.*integration/i,
          // User experience improvements
          /add.*user.*experience/i, /implement.*ux/i, /enhance.*ui/i,
          // Performance enhancements (not fixes)
          /optimize.*performance/i, /improve.*speed/i, /enhance.*efficiency/i,
          // New configuration options
          /add.*config/i, /implement.*setting/i, /create.*option/i
        ];

        return featurePatterns.some(pattern => pattern.test(diff));
      } catch {
        return true; // Default to feature for code files
      }
    }
    
    return false;
  }

  static isMaintenanceChange(file) {
    // Check for maintenance/no-version-change indicators
    const fileName = file.toLowerCase();
    const maintenancePatterns = [
      'chore', 'docs', 'style', 'refactor', 'test', 'ci', 'build',
      'readme', 'license', 'gitignore', 'config', 'lint'
    ];
    
    if (maintenancePatterns.some(pattern => fileName.includes(pattern))) {
      return true;
    }

    // File types that don't affect functionality
    if (file.includes('.md') || file.includes('README') || 
        file.includes('docs/') || file.includes('.json') ||
        file.includes('.yaml') || file.includes('.yml') ||
        file.includes('test/') || file.includes('.test.') ||
        file.includes('.spec.') || file.includes('__tests__/')) {
      return true;
    }

    try {
      const diff = execSync(`git diff HEAD -- "${file}"`, { encoding: 'utf8' });
      
      // Maintenance patterns in diff content
      const maintenancePatterns = [
        // Documentation
        /update.*documentation/i, /add.*comment/i, /improve.*readme/i,
        // Code style
        /format.*code/i, /style.*improvement/i, /lint.*fix/i,
        // Refactoring
        /refactor.*code/i, /reorganize.*structure/i, /clean.*up/i,
        // Testing
        /add.*test/i, /update.*test/i, /improve.*coverage/i,
        // Build/CI
        /update.*build/i, /modify.*ci/i, /change.*workflow/i,
        // Dependencies
        /update.*dependency/i, /upgrade.*package/i, /bump.*version/i
      ];

      return maintenancePatterns.some(pattern => pattern.test(diff));
    } catch {
      return false;
    }
  }

  static generateDescription(file, type) {
    const fileName = file.split('/').pop().replace(/\.(js|jsx|ts|tsx)$/, '');
    const directory = file.split('/').slice(-2, -1)[0];
    const fullPath = file.toLowerCase();
    
    // Use code analysis for intelligent description generation
    try {
      const analysis = CodeAnalysisEngine.analyzeCodeChanges(file);
      
      // Generate description based on analysis with specific file context
      if (analysis.type === 'PATCH') {
        // Specific handling for admin settings page
        if (fullPath.includes('admin/settings') && fileName === 'page') {
          return 'fix Webex settings display by using proper SSM API endpoint';
        }
        return `fix ${fileName} functionality issues`;
      } else if (analysis.type === 'MINOR') {
        return `enhance ${fileName} with new capabilities`;
      } else if (analysis.type === 'MAJOR') {
        return `implement breaking changes to ${fileName}`;
      } else {
        return `update ${fileName} maintenance and documentation`;
      }
    } catch (error) {
      // Fallback to existing logic
    }
    
    // Get actual diff content for better descriptions
    const diffContent = this.getDiffContent(file);

    // API endpoints
    if (file.includes('/api/')) {
      const endpoint = file.replace(/.*\/api\//, '').replace('/route.js', '');
      return type === 'fixes' 
        ? `resolve ${endpoint} API endpoint issues`
        : `enhance ${endpoint} API functionality`;
    }

    // Components
    if (file.includes('components/')) {
      return type === 'fixes'
        ? `fix ${fileName} component rendering issues`
        : `enhance ${fileName} component with new features`;
    }

    // Pages
    if (file.includes('page.js')) {
      return type === 'fixes'
        ? `resolve ${directory} page functionality issues`
        : `add new features to ${directory} page`;
    }

    // Admin dashboard
    if (file.includes('admin/')) {
      return type === 'fixes'
        ? `fix admin dashboard ${fileName} functionality`
        : `enhance admin dashboard with ${fileName} improvements`;
    }

    // Filters and UI
    if (file.includes('filter') || file.includes('Filter')) {
      return type === 'fixes'
        ? `resolve filtering system issues`
        : `implement advanced filtering system with visual enhancements`;
    }

    // Database/lib changes
    if (file.includes('lib/') || file.includes('database')) {
      return type === 'fixes'
        ? `fix database connectivity and query issues`
        : `enhance database operations and performance`;
    }

    // Configuration files
    if (file.includes('config') || file.includes('.json') || file.includes('.yaml')) {
      return `update application configuration and settings`;
    }

    // Analyze diff for specific changes
    if (diffContent) {
      const specificDesc = this.analyzeSpecificChanges(diffContent, file, type);
      if (specificDesc) return specificDesc;
    }

    // Default descriptions
    const defaultDescriptions = {
      'features': `add new functionality to ${fileName}`,
      'fixes': `resolve issues in ${fileName}`,
      'breaking': `implement breaking changes to ${fileName}`,
      'other': `update ${fileName} documentation and maintenance`
    };

    return defaultDescriptions[type] || `update ${fileName}`;
  }

  static getDiffContent(file) {
    try {
      return execSync(`git diff HEAD -- "${file}"`, { encoding: 'utf8' });
    } catch {
      return null;
    }
  }

  static analyzeSpecificChanges(diff, file, type) {
    // Look for specific patterns in the diff
    if (diff.includes('filter') && diff.includes('admin')) {
      return type === 'fixes' 
        ? 'resolve admin dashboard filter functionality'
        : 'implement admin dashboard filter system with enhanced UI';
    }
    
    if (diff.includes('navbar') || diff.includes('Navbar')) {
      return type === 'fixes'
        ? 'fix navigation bar display issues'
        : 'enhance navigation bar with new features';
    }
    
    if (diff.includes('webex') || diff.includes('WebEx')) {
      return type === 'fixes'
        ? 'resolve WebEx integration issues'
        : 'enhance WebEx notifications with system information';
    }
    
    if (diff.includes('attachment') || diff.includes('upload')) {
      return type === 'fixes'
        ? 'fix file attachment and upload functionality'
        : 'improve file attachment system with better UI';
    }
    
    if (diff.includes('database') || diff.includes('db.')) {
      return type === 'fixes'
        ? 'resolve database query and connection issues'
        : 'optimize database operations and queries';
    }
    
    return null;
  }

  static getChangesSummary() {
    const changes = ChangeTracker.loadChanges();
    const autoDetected = this.autoTrackChanges();
    
    return {
      tracked: changes,
      autoDetected: autoDetected.length,
      totalFiles: this.getModifiedFiles().length
    };
  }
}