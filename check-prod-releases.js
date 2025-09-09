#!/usr/bin/env node

import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: '.env.local' });

const client = new DynamoDBClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function checkProdReleases() {
  console.log('🔍 Checking PracticeTools-prod-Releases table...\n');
  
  try {
    const command = new ScanCommand({
      TableName: 'PracticeTools-prod-Releases'
    });
    
    const result = await client.send(command);
    const items = result.Items || [];
    
    console.log(`📊 Total releases in production table: ${items.length}\n`);
    
    if (items.length > 0) {
      console.log('📋 Production releases found:');
      items.forEach((item, index) => {
        const version = item.version?.S || 'Unknown';
        const date = item.date?.S || 'Unknown';
        const type = item.type?.S || 'Unknown';
        const notes = item.notes?.S || '';
        
        console.log(`${index + 1}. Version: ${version}`);
        console.log(`   Date: ${date}`);
        console.log(`   Type: ${type}`);
        console.log(`   Notes: ${notes ? notes.substring(0, 100) + '...' : 'No notes'}`);
        console.log('');
      });
      
      // Check for production vs dev versions
      const prodVersions = items.filter(item => !item.version?.S?.includes('-dev.'));
      const devVersions = items.filter(item => item.version?.S?.includes('-dev.'));
      
      console.log(`🏭 Production versions: ${prodVersions.length}`);
      console.log(`🔧 Development versions: ${devVersions.length}`);
      
      if (prodVersions.length > 0) {
        console.log('\n✅ Production releases exist in database');
        console.log('🔍 Issue must be in the API filtering logic');
      } else {
        console.log('\n⚠️  Only development releases found in production table');
        console.log('🔍 This explains why production API returns empty array');
      }
      
    } else {
      console.log('❌ No releases found in production table');
    }
    
  } catch (error) {
    console.error('❌ Error checking production releases:', error.message);
    if (error.name === 'ResourceNotFoundException') {
      console.log('📝 The PracticeTools-prod-Releases table does not exist');
    }
  }
}

checkProdReleases().catch(console.error);