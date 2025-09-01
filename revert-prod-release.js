#!/usr/bin/env node

// Simple script to revert production database back to v4.0.0

console.log('🔄 Manual database revert required...');
console.log('');
console.log('Please run these commands in AWS CLI or Console:');
console.log('');
console.log('1. Revert production current_version:');
console.log('   aws dynamodb put-item --table-name PracticeTools-Settings --item \'{"id":{"S":"current_version"},"value":{"S":"4.0.0"},"updated_at":{"S":"' + new Date().toISOString() + '"}}\'');
console.log('');
console.log('2. Set dev current_version:');
console.log('   aws dynamodb put-item --table-name PracticeTools-dev-Settings --item \'{"id":{"S":"current_version"},"value":{"S":"5.0.0-dev.3"},"updated_at":{"S":"' + new Date().toISOString() + '"}}\'');
console.log('');
console.log('3. Add dev release to dev table:');
console.log('   aws dynamodb put-item --table-name PracticeTools-dev-Releases --item \'{"id":{"S":"release-' + Date.now() + '"},"version":{"S":"5.0.0-dev.3"},"date":{"S":"' + new Date().toISOString().split('T')[0] + '"},"type":{"S":"Release"},"notes":{"S":"Dev release v5.0.0-dev.3"}}\'');
console.log('');
console.log('Or use AWS Console:');
console.log('- Go to DynamoDB');
console.log('- Update PracticeTools-Settings: current_version = "4.0.0"');
console.log('- Update PracticeTools-dev-Settings: current_version = "5.0.0-dev.3"');
console.log('- Add item to PracticeTools-dev-Releases with version "5.0.0-dev.3"');