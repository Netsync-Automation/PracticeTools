import { getEnvironment, getTableName } from './lib/dynamodb.js';

console.log('🔍 Checking current environment configuration...\n');

console.log('Environment:', getEnvironment());
console.log('Sites table name:', getTableName('Sites'));

console.log('\n📋 Environment variables:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('ENVIRONMENT:', process.env.ENVIRONMENT);

console.log('\n🔧 Expected table names:');
console.log('Dev Sites table: PracticeTools-dev-Sites');
console.log('Prod Sites table: PracticeTools-prod-Sites');