// Force production environment
process.env.ENVIRONMENT = 'prod';

import { db } from './lib/dynamodb.js';

async function checkProdEmailRules() {
  try {
    console.log('Forced environment to:', process.env.ENVIRONMENT);
    console.log('Checking production email rules...');
    
    const rules = await db.getEmailRules();
    console.log('Production email rules found:', rules.length);
    console.log('Production rules data:', JSON.stringify(rules, null, 2));
    
  } catch (error) {
    console.error('Error checking production email rules:', error);
  }
}

checkProdEmailRules();