import { DynamoDBClient, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const client = new DynamoDBClient({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  maxAttempts: 3,
  retryMode: 'adaptive',
});

const ISSUES_TABLE = 'PracticeTools-Issues';

async function migrateSystemField() {
  console.log('🔄 Starting system field migration...');
  
  try {
    // Get all issues
    console.log('📊 Scanning all issues...');
    const scanCommand = new ScanCommand({
      TableName: ISSUES_TABLE
    });
    
    const result = await client.send(scanCommand);
    const issues = result.Items || [];
    
    console.log(`📋 Found ${issues.length} issues to migrate`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const issue of issues) {
      const issueId = issue.id?.S;
      const issueNumber = issue.issue_number?.N;
      const currentSystem = issue.system?.S;
      
      if (!issueId) {
        console.log('⚠️ Skipping issue without ID');
        skippedCount++;
        continue;
      }
      
      if (currentSystem) {
        console.log(`⏭️ Issue #${issueNumber} already has system: ${currentSystem}`);
        skippedCount++;
        continue;
      }
      
      // Update issue with system field
      console.log(`🔄 Updating Issue #${issueNumber} with system: SCOOP`);
      
      const updateCommand = new UpdateItemCommand({
        TableName: ISSUES_TABLE,
        Key: { id: { S: issueId } },
        UpdateExpression: 'SET #system = :system',
        ExpressionAttributeNames: {
          '#system': 'system'
        },
        ExpressionAttributeValues: {
          ':system': { S: 'SCOOP' }
        }
      });
      
      try {
        await client.send(updateCommand);
        console.log(`✅ Updated Issue #${issueNumber}`);
        updatedCount++;
      } catch (error) {
        console.error(`❌ Failed to update Issue #${issueNumber}:`, error.message);
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`✅ Updated: ${updatedCount} issues`);
    console.log(`⏭️ Skipped: ${skippedCount} issues`);
    console.log(`📋 Total: ${issues.length} issues`);
    console.log('\n🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateSystemField();