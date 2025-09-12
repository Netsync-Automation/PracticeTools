#!/usr/bin/env node

/**
 * DSR - Do Shit Right
 * Pre-development compliance checker for PracticeTools
 * 
 * Ensures all code follows enterprise standards before any changes are made.
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

class DSRChecker {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.passed = [];
  }

  log(type, message, file = null) {
    const entry = { message, file, timestamp: new Date().toISOString() };
    this[type].push(entry);
    
    const icon = { errors: '❌', warnings: '⚠️', passed: '✅' }[type];
    const prefix = file ? `${file}: ` : '';
    console.log(`${icon} ${prefix}${message}`);
  }

  // Rule 1: Industry Best Practices
  checkIndustryBestPractices() {
    console.log('\n🔍 Checking Industry Best Practices...');
    
    // Check for proper error handling in API routes
    this.checkAPIErrorHandling();
    
    // Check for proper validation
    this.checkInputValidation();
    
    // Check for proper separation of concerns
    this.checkSeparationOfConcerns();
  }

  checkAPIErrorHandling() {
    const apiDir = 'app/api';
    if (!existsSync(apiDir)) return;

    this.walkDirectory(apiDir, (file) => {
      if (file.endsWith('route.js')) {
        const content = readFileSync(file, 'utf8');
        
        if (!content.includes('try {') || !content.includes('catch')) {
          this.log('errors', 'Missing try/catch error handling', file);
        } else {
          this.log('passed', 'Has proper error handling', file);
        }

        if (!content.includes('NextResponse.json') || !content.includes('status:')) {
          this.log('errors', 'Missing proper HTTP status codes', file);
        } else {
          this.log('passed', 'Uses proper HTTP responses', file);
        }
      }
    });
  }

  checkInputValidation() {
    const apiDir = 'app/api';
    if (!existsSync(apiDir)) return;

    this.walkDirectory(apiDir, (file) => {
      if (file.endsWith('route.js')) {
        const content = readFileSync(file, 'utf8');
        
        if (content.includes('await request.json()') && !content.includes('if (!')) {
          this.log('warnings', 'Consider adding input validation', file);
        }
      }
    });
  }

  checkSeparationOfConcerns() {
    // Check if database operations are in lib/dynamodb.js
    if (!existsSync('lib/dynamodb.js')) {
      this.log('errors', 'Missing database service layer (lib/dynamodb.js)');
    } else {
      this.log('passed', 'Database service layer exists');
    }
  }

  // Rule 2: Environment Awareness
  checkEnvironmentAwareness() {
    console.log('\n🌍 Checking Environment Awareness...');
    
    this.checkDatabaseTableNames();
    this.checkAPIEnvironmentUsage();
    this.checkConfigFiles();
  }

  checkDatabaseTableNames() {
    if (existsSync('lib/dynamodb.js')) {
      const content = readFileSync('lib/dynamodb.js', 'utf8');
      
      if (content.includes('getTableName') && content.includes('getEnvironment')) {
        this.log('passed', 'Database uses environment-aware table naming');
      } else {
        this.log('errors', 'Database missing environment-aware table naming');
      }
    }
  }

  checkAPIEnvironmentUsage() {
    this.walkDirectory('app/api', (file) => {
      if (file.endsWith('route.js')) {
        const content = readFileSync(file, 'utf8');
        
        if (content.includes('db.') && !content.includes('process.env.ENVIRONMENT')) {
          // Check if it imports from dynamodb.js (which handles environment)
          if (content.includes("from '../../../lib/dynamodb") || content.includes("from '../../lib/dynamodb")) {
            this.log('passed', 'Uses environment-aware database service', file);
          } else {
            this.log('warnings', 'Consider using environment-aware database service', file);
          }
        }
      }
    });
  }

  checkConfigFiles() {
    const configs = ['apprunner-dev.yaml', 'apprunner-prod.yaml'];
    configs.forEach(config => {
      if (existsSync(config)) {
        this.log('passed', `Environment config exists: ${config}`);
      } else {
        this.log('errors', `Missing environment config: ${config}`);
      }
    });
  }

  // Rule 3: Database-Stored Dropdowns
  checkDatabaseStoredDropdowns() {
    console.log('\n💾 Checking Database-Stored Dropdowns...');
    
    this.walkDirectory('app', (file) => {
      if (file.endsWith('.js') || file.endsWith('.jsx')) {
        const content = readFileSync(file, 'utf8');
        
        // Look for hardcoded select options
        if (content.includes('<option') && content.includes('value=')) {
          const lines = content.split('\n');
          let hasHardcodedOptions = false;
          
          lines.forEach((line, index) => {
            if (line.includes('<option') && line.includes('value=') && 
                !line.includes('.map') && !line.includes('{') && 
                line.includes('"') && !line.includes('Select')) {
              hasHardcodedOptions = true;
            }
          });
          
          if (hasHardcodedOptions) {
            this.log('warnings', 'Consider storing dropdown options in database', file);
          }
        }
      }
    });
  }

  // Rule 4: Security Best Practices
  checkSecurityBestPractices() {
    console.log('\n🔒 Checking Security Best Practices...');
    
    this.checkAuthenticationUsage();
    this.checkInputSanitization();
    this.checkSecretManagement();
  }

  checkAuthenticationUsage() {
    this.walkDirectory('app', (file) => {
      if (file.endsWith('page.js')) {
        const content = readFileSync(file, 'utf8');
        
        if (content.includes('useAuth') || content.includes('AccessCheck')) {
          this.log('passed', 'Uses authentication', file);
        } else if (!file.includes('login') && !file.includes('public')) {
          this.log('warnings', 'Consider adding authentication', file);
        }
      }
    });
  }

  checkInputSanitization() {
    this.walkDirectory('app/api', (file) => {
      if (file.endsWith('route.js')) {
        const content = readFileSync(file, 'utf8');
        
        if (content.includes('request.json()') && !content.includes('trim()')) {
          this.log('warnings', 'Consider input sanitization (trim, validation)', file);
        }
      }
    });
  }

  checkSecretManagement() {
    this.walkDirectory('.', (file) => {
      if (file.endsWith('.js') || file.endsWith('.jsx')) {
        const content = readFileSync(file, 'utf8');
        
        // Check for hardcoded secrets (basic patterns)
        const secretPatterns = [
          /password\s*=\s*["'][^"']+["']/i,
          /api[_-]?key\s*=\s*["'][^"']+["']/i,
          /secret\s*=\s*["'][^"']+["']/i
        ];
        
        secretPatterns.forEach(pattern => {
          if (pattern.test(content) && !content.includes('process.env')) {
            this.log('errors', 'Potential hardcoded secret detected', file);
          }
        });
      }
    });
  }

  // Rule 5: SSE for Real-time Updates
  checkSSEImplementation() {
    console.log('\n⚡ Checking SSE Implementation...');
    
    // Check if SSE service exists
    if (existsSync('app/api/events/route.js')) {
      this.log('passed', 'SSE endpoint exists');
    } else {
      this.log('warnings', 'No SSE endpoint found - consider for real-time features');
    }

    // Check for real-time update patterns
    this.walkDirectory('app', (file) => {
      if (file.endsWith('.js') || file.endsWith('.jsx')) {
        const content = readFileSync(file, 'utf8');
        
        if (content.includes('EventSource') || content.includes('sse')) {
          this.log('passed', 'Uses SSE for real-time updates', file);
        }
      }
    });
  }

  // Rule 6: Temporary Script Cleanup
  checkTemporaryScripts() {
    console.log('\n🧹 Checking for Temporary Scripts...');
    
    const tempPatterns = [
      /^test-.*\.js$/,
      /^debug-.*\.js$/,
      /^temp-.*\.js$/,
      /^tmp-.*\.js$/,
      /.*-test\.js$/,
      /.*-debug\.js$/
    ];

    this.walkDirectory('.', (file) => {
      const filename = file.split('/').pop();
      
      tempPatterns.forEach(pattern => {
        if (pattern.test(filename)) {
          this.log('warnings', 'Temporary script detected - consider cleanup', file);
        }
      });
    });
  }

  // Rule 7: Debug Code Cleanup
  checkDebugCode() {
    console.log('\n🐛 Checking for Debug Code...');
    
    this.walkDirectory('.', (file) => {
      if (file.endsWith('.js') || file.endsWith('.jsx')) {
        const content = readFileSync(file, 'utf8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          // Check for console.log statements
          if (line.includes('console.log') && !line.includes('//')) {
            this.log('warnings', `Debug console.log at line ${index + 1}`, file);
          }
          
          // Check for debug comments
          if (line.includes('// DEBUG') || line.includes('// TODO: REMOVE')) {
            this.log('warnings', `Debug comment at line ${index + 1}`, file);
          }
        });
      }
    });
  }

  // Utility method to walk directory recursively
  walkDirectory(dir, callback) {
    if (!existsSync(dir)) return;
    
    const items = readdirSync(dir);
    
    items.forEach(item => {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip node_modules, .git, .next, etc.
        if (!['node_modules', '.git', '.next', 'dist', 'build'].includes(item)) {
          this.walkDirectory(fullPath, callback);
        }
      } else {
        callback(fullPath);
      }
    });
  }

  // Main execution
  async run() {
    console.log('🚀 DSR - Do Shit Right');
    console.log('📋 Pre-development compliance checker\n');

    // Run all checks
    this.checkIndustryBestPractices();
    this.checkEnvironmentAwareness();
    this.checkDatabaseStoredDropdowns();
    this.checkSecurityBestPractices();
    this.checkSSEImplementation();
    this.checkTemporaryScripts();
    this.checkDebugCode();

    // Summary
    console.log('\n📊 DSR SUMMARY');
    console.log(`✅ Passed: ${this.passed.length}`);
    console.log(`⚠️  Warnings: ${this.warnings.length}`);
    console.log(`❌ Errors: ${this.errors.length}`);

    if (this.errors.length > 0) {
      console.log('\n❌ CRITICAL ISSUES FOUND - FIX BEFORE PROCEEDING:');
      this.errors.forEach(error => {
        console.log(`   ${error.file ? error.file + ': ' : ''}${error.message}`);
      });
      process.exit(1);
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS - CONSIDER ADDRESSING:');
      this.warnings.forEach(warning => {
        console.log(`   ${warning.file ? warning.file + ': ' : ''}${warning.message}`);
      });
    }

    console.log('\n✅ DSR CHECK COMPLETE - READY TO PROCEED');
    return true;
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const checker = new DSRChecker();
  checker.run().catch(console.error);
}

export { DSRChecker };