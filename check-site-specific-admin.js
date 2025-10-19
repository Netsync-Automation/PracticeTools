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

async function testSiteSpecificEndpoints(accessToken) {
  console.log('🔍 TESTING SITE-SPECIFIC ADMIN ENDPOINTS\n');
  
  const siteTests = [
    {
      name: 'Site Admin - Meeting Transcripts',
      url: 'https://webexapis.com/v1/admin/meetingTranscripts?siteUrl=netsync.webex.com&max=1',
      description: 'Admin transcripts for netsync.webex.com site'
    },
    {
      name: 'Site Admin - Meeting Transcripts (no siteUrl)',
      url: 'https://webexapis.com/v1/admin/meetingTranscripts?max=1',
      description: 'Admin transcripts without site specification'
    },
    {
      name: 'Site Admin - Events',
      url: 'https://webexapis.com/v1/admin/events?siteUrl=netsync.webex.com&max=1',
      description: 'Admin events for netsync.webex.com site'
    },
    {
      name: 'Site Admin - Meetings',
      url: 'https://webexapis.com/v1/admin/meetings?siteUrl=netsync.webex.com&max=1',
      description: 'Admin meetings for netsync.webex.com site'
    },
    {
      name: 'Site Users',
      url: 'https://webexapis.com/v1/people?siteUrl=netsync.webex.com&max=1',
      description: 'Users for netsync.webex.com site'
    }
  ];
  
  for (const test of siteTests) {
    console.log(`📡 ${test.name}`);
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
        console.log(`   ✅ SUCCESS - Has site admin access`);
        console.log(`   📊 Items returned: ${data.items ? data.items.length : 'N/A'}`);
        
        if (data.items && data.items.length > 0) {
          console.log(`   📄 First item preview: ${JSON.stringify(data.items[0]).substring(0, 100)}...`);
        }
      } else {
        const errorText = await response.text();
        console.log(`   ❌ FAILED - ${errorText.substring(0, 150)}...`);
      }
      
    } catch (error) {
      console.log(`   ❌ NETWORK ERROR - ${error.message}`);
    }
    
    console.log('');
  }
}

async function testAlternativeAdminEndpoints(accessToken) {
  console.log('🔍 TESTING ALTERNATIVE ADMIN ENDPOINT FORMATS\n');
  
  const altTests = [
    {
      name: 'XML API - Site Admin Check',
      url: 'https://netsync.webex.com/WBXService/XMLService',
      method: 'POST',
      body: `<?xml version="1.0" encoding="UTF-8"?>
<serv:message xmlns:serv="http://www.webex.com/schemas/2002/06/service">
  <header>
    <securityContext>
      <webExID>mbgriffin@netsync.com</webExID>
      <sessionTicket>${accessToken}</sessionTicket>
    </securityContext>
  </header>
  <body>
    <bodyContent xsi:type="java:com.webex.service.binding.user.GetUser" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <webExId>mbgriffin@netsync.com</webExId>
    </bodyContent>
  </body>
</serv:message>`,
      description: 'XML API to check site admin status'
    },
    {
      name: 'Site-specific API Base',
      url: 'https://netsync.webex.com/api/v1/admin/meetingTranscripts?max=1',
      description: 'Direct site API endpoint'
    }
  ];
  
  for (const test of altTests) {
    console.log(`📡 ${test.name}`);
    console.log(`   URL: ${test.url}`);
    console.log(`   Description: ${test.description}`);
    
    try {
      const options = {
        method: test.method || 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': test.method === 'POST' ? 'text/xml' : 'application/json'
        }
      };
      
      if (test.body) {
        options.body = test.body;
      }
      
      const response = await fetch(test.url, options);
      
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const responseText = await response.text();
        console.log(`   ✅ SUCCESS`);
        console.log(`   📄 Response preview: ${responseText.substring(0, 200)}...`);
      } else {
        const errorText = await response.text();
        console.log(`   ❌ FAILED - ${errorText.substring(0, 150)}...`);
      }
      
    } catch (error) {
      console.log(`   ❌ NETWORK ERROR - ${error.message}`);
    }
    
    console.log('');
  }
}

async function main() {
  console.log('🔍 SITE-SPECIFIC WEBEX ADMIN ACCESS CHECK');
  console.log('=========================================\n');
  console.log('Testing admin access specifically for netsync.webex.com site\n');
  
  const accessToken = await getSSMParameter('/PracticeTools/dev/WEBEX_MEETINGS_ACCESS_TOKEN');
  
  if (!accessToken) {
    console.log('❌ No access token found');
    process.exit(1);
  }
  
  console.log(`✅ Access token: ${accessToken.substring(0, 30)}...\n`);
  
  await testSiteSpecificEndpoints(accessToken);
  await testAlternativeAdminEndpoints(accessToken);
  
  console.log('\n🎯 ANALYSIS:');
  console.log('If site-specific endpoints return 200 OK, the user has site admin privileges.');
  console.log('Site admin privileges are different from organization admin privileges.');
  console.log('The meeting:admin_transcripts_read scope may work with site-specific parameters.');
}

main().catch(console.error);