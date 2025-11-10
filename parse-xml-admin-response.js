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

async function testXMLAdminAPI(accessToken) {
  console.log('🔍 TESTING XML API FOR ADMIN PRIVILEGES\n');
  
  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
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
</serv:message>`;

  try {
    console.log('📡 Calling XML API to get user details and privileges...');
    const response = await fetch('https://netsync.webex.com/WBXService/XMLService', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        'Authorization': `Bearer ${accessToken}`
      },
      body: xmlBody
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const xmlResponse = await response.text();
      console.log('\n✅ XML API SUCCESS');
      console.log('📄 Full XML Response:');
      console.log(xmlResponse);
      
      // Look for admin-related keywords in the XML
      const adminKeywords = ['admin', 'privilege', 'role', 'permission', 'site'];
      console.log('\n🔍 SEARCHING FOR ADMIN INDICATORS:');
      
      adminKeywords.forEach(keyword => {
        const regex = new RegExp(keyword, 'gi');
        const matches = xmlResponse.match(regex);
        if (matches) {
          console.log(`   ✅ Found "${keyword}": ${matches.length} occurrences`);
        } else {
          console.log(`   ❌ No "${keyword}" found`);
        }
      });
      
      // Extract specific XML elements that might indicate admin status
      const privilegeMatch = xmlResponse.match(/<privilege[^>]*>(.*?)<\/privilege>/gi);
      const roleMatch = xmlResponse.match(/<role[^>]*>(.*?)<\/role>/gi);
      const adminMatch = xmlResponse.match(/<[^>]*admin[^>]*>(.*?)<\/[^>]*>/gi);
      
      if (privilegeMatch) {
        console.log('\n🔑 PRIVILEGES FOUND:');
        privilegeMatch.forEach(priv => console.log(`   ${priv}`));
      }
      
      if (roleMatch) {
        console.log('\n👤 ROLES FOUND:');
        roleMatch.forEach(role => console.log(`   ${role}`));
      }
      
      if (adminMatch) {
        console.log('\n🛡️ ADMIN ELEMENTS FOUND:');
        adminMatch.forEach(admin => console.log(`   ${admin}`));
      }
      
    } else {
      const errorText = await response.text();
      console.log(`❌ XML API Failed: ${errorText}`);
    }
    
  } catch (error) {
    console.log(`❌ Network Error: ${error.message}`);
  }
}

async function testDifferentXMLQueries(accessToken) {
  console.log('\n🔍 TESTING DIFFERENT XML ADMIN QUERIES\n');
  
  const xmlQueries = [
    {
      name: 'Get Site Info',
      body: `<?xml version="1.0" encoding="UTF-8"?>
<serv:message xmlns:serv="http://www.webex.com/schemas/2002/06/service">
  <header>
    <securityContext>
      <webExID>mbgriffin@netsync.com</webExID>
      <sessionTicket>${accessToken}</sessionTicket>
    </securityContext>
  </header>
  <body>
    <bodyContent xsi:type="java:com.webex.service.binding.site.GetSite" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    </bodyContent>
  </body>
</serv:message>`
    },
    {
      name: 'List Users (Admin Function)',
      body: `<?xml version="1.0" encoding="UTF-8"?>
<serv:message xmlns:serv="http://www.webex.com/schemas/2002/06/service">
  <header>
    <securityContext>
      <webExID>mbgriffin@netsync.com</webExID>
      <sessionTicket>${accessToken}</sessionTicket>
    </securityContext>
  </header>
  <body>
    <bodyContent xsi:type="java:com.webex.service.binding.user.LstUser" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <listControl>
        <maximumNum>5</maximumNum>
      </listControl>
    </bodyContent>
  </body>
</serv:message>`
    }
  ];
  
  for (const query of xmlQueries) {
    console.log(`📡 Testing: ${query.name}`);
    
    try {
      const response = await fetch('https://netsync.webex.com/WBXService/XMLService', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
          'Authorization': `Bearer ${accessToken}`
        },
        body: query.body
      });
      
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const xmlResponse = await response.text();
        console.log(`   ✅ SUCCESS - Response length: ${xmlResponse.length} chars`);
        
        // Check for success/failure indicators
        if (xmlResponse.includes('<serv:result>SUCCESS</serv:result>')) {
          console.log('   🎉 XML indicates SUCCESS');
        } else if (xmlResponse.includes('<serv:result>FAILURE</serv:result>')) {
          console.log('   ❌ XML indicates FAILURE');
        }
        
        console.log(`   📄 Preview: ${xmlResponse.substring(0, 200)}...`);
      } else {
        console.log(`   ❌ FAILED`);
      }
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
    
    console.log('');
  }
}

async function main() {
  console.log('🔍 XML API ADMIN PRIVILEGE ANALYSIS');
  console.log('===================================\n');
  
  const accessToken = await getSSMParameter('/PracticeTools/dev/WEBEX_MEETINGS_ACCESS_TOKEN');
  
  if (!accessToken) {
    console.log('❌ No access token found');
    process.exit(1);
  }
  
  console.log(`✅ Access token: ${accessToken.substring(0, 30)}...\n`);
  
  await testXMLAdminAPI(accessToken);
  await testDifferentXMLQueries(accessToken);
  
  console.log('\n🎯 CONCLUSION:');
  console.log('If XML API shows admin privileges but REST API fails,');
  console.log('the user may have legacy site admin access but not modern API admin access.');
}

main().catch(console.error);