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

async function testAdminTranscriptEndpoint(accessToken) {
  console.log('🔍 DETAILED ADMIN TRANSCRIPT ENDPOINT TEST\n');
  
  const testUrls = [
    'https://webexapis.com/v1/admin/meetingTranscripts',
    'https://webexapis.com/v1/admin/meetingTranscripts?max=1',
    'https://webexapis.com/v1/meetingTranscripts?max=1', // Regular endpoint for comparison
  ];
  
  for (const url of testUrls) {
    console.log(`\n📡 Testing: ${url}`);
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      // Get response headers
      const headers = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      console.log(`   Headers:`, JSON.stringify(headers, null, 4));
      
      // Get response body
      const responseText = await response.text();
      console.log(`   Body: ${responseText}`);
      
      if (responseText) {
        try {
          const responseJson = JSON.parse(responseText);
          console.log(`   Parsed JSON:`, JSON.stringify(responseJson, null, 4));
        } catch (e) {
          console.log(`   (Not valid JSON)`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Network Error: ${error.message}`);
    }
  }
}

async function main() {
  console.log('🔍 WEBEX ADMIN TRANSCRIPT DETAILED TEST');
  console.log('=======================================\n');
  
  const accessToken = await getSSMParameter('/PracticeTools/dev/WEBEX_MEETINGS_ACCESS_TOKEN');
  
  if (!accessToken) {
    console.log('❌ No access token found');
    process.exit(1);
  }
  
  console.log(`✅ Access token found (${accessToken.length} characters)`);
  console.log(`   Preview: ${accessToken.substring(0, 30)}...`);
  
  await testAdminTranscriptEndpoint(accessToken);
}

main().catch(console.error);