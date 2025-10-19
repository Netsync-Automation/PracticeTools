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

async function testAdminEndpoints(accessToken) {
  console.log('🔍 TESTING ADMIN ENDPOINTS TO VERIFY PRIVILEGES\n');
  
  const adminTests = [
    {
      name: 'Admin People List',
      url: 'https://webexapis.com/v1/people?max=1',
      description: 'List people in organization (admin scope)'
    },
    {
      name: 'Admin Organizations',
      url: 'https://webexapis.com/v1/organizations',
      description: 'List organizations (admin scope)'
    },
    {
      name: 'Admin Licenses',
      url: 'https://webexapis.com/v1/licenses',
      description: 'List licenses (admin scope)'
    },
    {
      name: 'Admin Meeting Transcripts',
      url: 'https://webexapis.com/v1/admin/meetingTranscripts?max=1',
      description: 'Admin meeting transcripts (requires site admin)'
    },
    {
      name: 'Regular Meeting Transcripts',
      url: 'https://webexapis.com/v1/meetingTranscripts?max=1',
      description: 'User meeting transcripts (user scope)'
    }
  ];
  
  for (const test of adminTests) {
    console.log(`📡 Testing: ${test.name}`);
    console.log(`   URL: ${test.url}`);
    console.log(`   Description: ${test.description}`);
    
    try {
      const response = await fetch(test.url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ SUCCESS - Response has ${data.items ? data.items.length : 'unknown'} items`);
      } else {
        const errorText = await response.text();
        console.log(`   ❌ FAILED - ${errorText.substring(0, 100)}...`);
      }
      
    } catch (error) {
      console.log(`   ❌ NETWORK ERROR - ${error.message}`);
    }
    
    console.log('');
  }
}

async function checkUserWithCallingScope(accessToken) {
  console.log('🔍 CHECKING USER WITH CALLING SCOPE\n');
  
  try {
    // Try with calling scope which might return more details
    const response = await fetch('https://webexapis.com/v1/people/me?callingData=true', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('User data with calling scope:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log('Failed to get calling data');
    }
    
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
}

async function main() {
  console.log('🔍 WEBEX ADMIN STATUS VERIFICATION');
  console.log('==================================\n');
  
  const accessToken = await getSSMParameter('/PracticeTools/dev/WEBEX_MEETINGS_ACCESS_TOKEN');
  
  if (!accessToken) {
    console.log('❌ No access token found');
    process.exit(1);
  }
  
  console.log(`✅ Access token: ${accessToken.substring(0, 30)}...\n`);
  
  await testAdminEndpoints(accessToken);
  await checkUserWithCallingScope(accessToken);
  
  console.log('\n🎯 ANALYSIS:');
  console.log('If admin endpoints return 200 OK, the user has admin privileges.');
  console.log('If they return 403 Forbidden, the user lacks admin roles.');
  console.log('The meeting:admin_transcripts_read scope requires site admin privileges.');
}

main().catch(console.error);