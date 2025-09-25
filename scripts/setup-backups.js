#!/usr/bin/env node

import { DynamoDBClient, UpdateContinuousBackupsCommand, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { BackupClient, CreateBackupPlanCommand, CreateBackupSelectionCommand } from '@aws-sdk/client-backup';

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const backupClient = new BackupClient({ region: 'us-east-1' });

async function enablePITR() {
  console.log('🔄 Enabling Point-in-Time Recovery for production tables...');
  
  const { TableNames } = await dynamoClient.send(new ListTablesCommand({}));
  const prodTables = TableNames.filter(name => name.startsWith('PracticeTools-prod-'));
  
  for (const tableName of prodTables) {
    try {
      await dynamoClient.send(new UpdateContinuousBackupsCommand({
        TableName: tableName,
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true
        }
      }));
      console.log(`✅ PITR enabled for ${tableName}`);
    } catch (error) {
      console.error(`❌ Failed to enable PITR for ${tableName}:`, error.message);
    }
  }
}

async function setupAWSBackup() {
  console.log('🔄 Setting up AWS Backup plan...');
  
  const backupPlan = {
    BackupPlanName: 'PracticeTools-Daily-Backup',
    Rules: [{
      RuleName: 'DailyBackups',
      TargetBackupVaultName: 'default',
      ScheduleExpression: 'cron(0 2 ? * * *)',
      StartWindowMinutes: 60,
      CompletionWindowMinutes: 120,
      Lifecycle: {
        DeleteAfterDays: 90,
        MoveToColdStorageAfterDays: 30
      }
    }]
  };
  
  try {
    const { BackupPlanId } = await backupClient.send(new CreateBackupPlanCommand({
      BackupPlan: backupPlan
    }));
    
    console.log(`✅ Backup plan created: ${BackupPlanId}`);
    
    // Create resource selection
    await backupClient.send(new CreateBackupSelectionCommand({
      BackupPlanId,
      BackupSelection: {
        SelectionName: 'PracticeTools-Tables',
        IamRoleArn: 'arn:aws:iam::YOUR_ACCOUNT:role/service-role/AWSBackupDefaultServiceRole',
        Resources: ['arn:aws:dynamodb:us-east-1:YOUR_ACCOUNT:table/PracticeTools-prod-*']
      }
    }));
    
    console.log('✅ Resource selection created');
  } catch (error) {
    console.error('❌ Failed to setup AWS Backup:', error.message);
  }
}

async function main() {
  console.log('🚀 Setting up PracticeTools backup solution...\n');
  
  await enablePITR();
  console.log();
  await setupAWSBackup();
  
  console.log('\n✅ Backup setup complete!');
  console.log('📊 Monitor backups in AWS Backup console');
}

main().catch(console.error);