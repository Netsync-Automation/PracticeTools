import { db } from './lib/dynamodb.js';

async function checkEmailRules() {
  try {
    console.log('Environment:', process.env.ENVIRONMENT || 'dev');
    console.log('Checking email rules...');
    
    const rules = await db.getEmailRules();
    console.log('Email rules found:', rules.length);
    console.log('Rules data:', JSON.stringify(rules, null, 2));
    
  } catch (error) {
    console.error('Error checking email rules:', error);
  }
}

checkEmailRules();