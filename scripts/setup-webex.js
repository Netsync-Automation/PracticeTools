#!/usr/bin/env node

const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const { db } = require('../lib/dynamodb');

const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

async function getSecretValue(parameterName) {
  try {
    const command = new GetParameterCommand({
      Name: parameterName,
      WithDecryption: true
    });
    const response = await ssmClient.send(command);
    return response.Parameter?.Value;
  } catch (error) {
    console.error(`Failed to get parameter ${parameterName}:`, error.message);
    return null;
  }
}

async function setupWebexIntegration() {
  console.log('🔧 Setting up WebEx integration from AWS Parameter Store...');
  
  try {
    // Get WebEx settings from Parameter Store
    const [accessToken, roomName, roomId] = await Promise.all([
      getSecretValue('WEBEX_SCOOP_ACCESS_TOKEN'),
      getSecretValue('WEBEX_SCOOP_ROOM_NAME'), 
      getSecretValue('WEBEX_SCOOP_ROOM_ID_1')
    ]);

    if (!accessToken || !roomName || !roomId) {
      console.log('⚠️  WebEx parameters not found or incomplete, skipping setup');
      console.log(`  Access Token: ${accessToken ? 'Found' : 'Missing'}`);
      console.log(`  Room Name: ${roomName ? 'Found' : 'Missing'}`);
      console.log(`  Room ID: ${roomId ? 'Found' : 'Missing'}`);
      return;
    }

    // Save WebEx settings to database
    const webexSettings = {
      enabled: true,
      accessToken: accessToken,
      roomName: roomName,
      roomId: roomId
    };

    const success = await db.saveSetting('webex_integration', JSON.stringify(webexSettings));
    
    if (success) {
      console.log('✅ WebEx integration configured successfully');
      console.log(`   Room: ${roomName}`);
      console.log(`   Room ID: ${roomId}`);
      console.log(`   Access Token: ${accessToken.substring(0, 20)}...`);
    } else {
      console.error('❌ Failed to save WebEx settings to database');
    }
  } catch (error) {
    console.error('❌ Error setting up WebEx integration:', error);
  }
}

// Run if called directly
if (require.main === module) {
  setupWebexIntegration()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { setupWebexIntegration };