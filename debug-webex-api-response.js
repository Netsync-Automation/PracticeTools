#!/usr/bin/env node

import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssmClient = new SSMClient({ region: 'us-east-1' });

async function getSSMParameter(name) {
  try {
    const command = new GetParameterCommand({
      Name: name,
      WithDecryption: true
    });
    const response = await ssmClient.send(command);
    return response.Parameter?.Value;
  } catch (error) {
    console.error(`Error getting ${name}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🔍 DEBUG WEBEX API RESPONSE');
  console.log('===========================\n');
  
  const accessToken = await getSSMParameter('/PracticeTools/dev/WEBEX_MEETINGS_ACCESS_TOKEN');
  
  if (!accessToken) {
    console.log('❌ No access token found');
    process.exit(1);
  }
  
  console.log(`✅ Access token: ${accessToken.substring(0, 30)}...\n`);
  
  try {
    console.log('📡 Raw fetch to /v1/people/me...');
    const response = await fetch('https://webexapis.com/v1/people/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log('Response Headers:');
    response.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });
    
    const rawText = await response.text();
    console.log(`\nRaw Response Body (${rawText.length} chars):`);
    console.log(rawText);
    
    console.log('\nParsed JSON:');
    try {
      const parsed = JSON.parse(rawText);
      console.log(JSON.stringify(parsed, null, 2));
      
      console.log('\n🔍 DETAILED FIELD ANALYSIS:');
      console.log(`roles field exists: ${parsed.hasOwnProperty('roles')}`);
      console.log(`roles value: ${JSON.stringify(parsed.roles)}`);
      console.log(`roles type: ${typeof parsed.roles}`);
      console.log(`roles length: ${Array.isArray(parsed.roles) ? parsed.roles.length : 'N/A'}`);
      
      console.log(`licenses field exists: ${parsed.hasOwnProperty('licenses')}`);
      console.log(`licenses value: ${JSON.stringify(parsed.licenses)}`);
      console.log(`licenses type: ${typeof parsed.licenses}`);
      console.log(`licenses length: ${Array.isArray(parsed.licenses) ? parsed.licenses.length : 'N/A'}`);
      
    } catch (e) {
      console.log(`JSON Parse Error: ${e.message}`);
    }
    
  } catch (error) {
    console.log(`❌ Network Error: ${error.message}`);
  }
}

main().catch(console.error);