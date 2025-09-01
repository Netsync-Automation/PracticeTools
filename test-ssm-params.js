#!/usr/bin/env node

import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

async function testSSMParams() {
  try {
    const ssmClient = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });
    const ENV = process.env.ENVIRONMENT || 'prod';
    
    console.log('🔍 Testing SSM Parameter Access...');
    console.log('Environment:', ENV);
    console.log('AWS Region:', process.env.AWS_DEFAULT_REGION || 'us-east-1');
    
    // Test both paths
    const paths = [
      '/PracticeTools/WEBEX_SCOOP_ACCESS_TOKEN',
      '/PracticeTools/dev/WEBEX_SCOOP_ACCESS_TOKEN'
    ];
    
    for (const path of paths) {
      try {
        console.log(`\n📋 Testing parameter: ${path}`);
        const command = new GetParameterCommand({ Name: path });
        const result = await ssmClient.send(command);
        const token = result.Parameter?.Value;
        console.log(`✅ Found token: ${token ? token.substring(0, 10) + '...' : 'EMPTY'}`);
        console.log(`Token length: ${token ? token.length : 0} characters`);
      } catch (error) {
        console.log(`❌ Parameter not found: ${error.name}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSSMParams();