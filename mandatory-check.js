#!/usr/bin/env node

/**
 * Mandatory Breaking Change Prevention Protocol Check
 * This script MUST be run before making ANY code changes
 * Now uses enhanced database-driven feature tracking
 */

import { enforceBCPP } from './realtime-bcpp.js';

// Main execution - MANDATORY BCPP enforcement
enforceBCPP().catch(error => {
  console.error('❌ MANDATORY BCPP CHECK FAILED:', error);
  process.exit(1);
});