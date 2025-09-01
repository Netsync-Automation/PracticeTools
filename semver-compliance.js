#!/usr/bin/env node

// Semantic Versioning Compliance Documentation and Validation

export const SemVerStandards = {
  
  // Industry standard breaking change patterns
  BREAKING_CHANGES: {
    // API Breaking Changes
    api: [
      'remove public function',
      'remove public method', 
      'change function signature',
      'change method parameters',
      'change return type',
      'remove public property',
      'rename public interface'
    ],
    
    // Configuration Breaking Changes  
    config: [
      'remove configuration option',
      'rename configuration key',
      'change default behavior',
      'require new mandatory config',
      'remove environment variable'
    ],
    
    // Database Breaking Changes
    database: [
      'remove database column',
      'rename database table', 
      'change column data type',
      'remove API endpoint',
      'change endpoint URL structure'
    ],
    
    // User Interface Breaking Changes
    ui: [
      'remove user feature',
      'change URL routes',
      'remove UI component',
      'change component props (breaking)',
      'remove user workflow'
    ]
  },
  
  // What are NOT breaking changes
  NON_BREAKING_CHANGES: {
    // Internal Improvements (PATCH/MINOR)
    internal: [
      'refactor internal code',
      'improve performance',
      'enhance error handling',
      'add logging',
      'improve code structure'
    ],
    
    // New Features (MINOR)
    features: [
      'add new optional feature',
      'add new API endpoint',
      'add new configuration option',
      'enhance existing feature',
      'add new UI component'
    ],
    
    // Bug Fixes (PATCH)
    fixes: [
      'fix bug',
      'resolve error',
      'correct behavior',
      'patch security issue',
      'fix performance issue'
    ],
    
    // Maintenance (NO VERSION)
    maintenance: [
      'update documentation',
      'improve code style',
      'add tests',
      'update dependencies',
      'refactor without behavior change'
    ]
  },
  
  // Validation function
  validateChange(description, fileChanges) {
    const desc = description.toLowerCase();
    
    // Check for explicit breaking change markers
    if (desc.includes('breaking change') || desc.includes('breaking:')) {
      return 'MAJOR';
    }
    
    // Check against breaking change patterns
    for (const category of Object.values(this.BREAKING_CHANGES)) {
      if (category.some(pattern => desc.includes(pattern))) {
        return 'MAJOR';
      }
    }
    
    // Check for new features
    const featurePatterns = [
      'add new', 'implement', 'introduce', 'create', 'enhance', 'improve'
    ];
    if (featurePatterns.some(pattern => desc.includes(pattern))) {
      return 'MINOR';
    }
    
    // Check for bug fixes
    const fixPatterns = [
      'fix', 'resolve', 'correct', 'patch', 'repair', 'bug', 'issue',
      'commit body', 'executecommits', 'git commit', 'multiline'
    ];
    if (fixPatterns.some(pattern => desc.includes(pattern))) {
      return 'PATCH';
    }
    
    // Check for maintenance
    const maintenancePatterns = [
      'update doc', 'refactor', 'style', 'test', 'chore'
    ];
    if (maintenancePatterns.some(pattern => desc.includes(pattern))) {
      return 'NONE';
    }
    
    // Default to MINOR for code changes
    return 'MINOR';
  }
};

// Export for use in other modules
export default SemVerStandards;