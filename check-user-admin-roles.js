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

async function checkUserRoles(accessToken, userId) {
  console.log('🔍 CHECKING USER ROLES VIA DIFFERENT API METHODS\n');
  
  const roleChecks = [
    {
      name: 'Get User Details with Roles',
      url: `https://webexapis.com/v1/people/${userId}`,
      description: 'Direct user lookup by ID'
    },
    {
      name: 'Search User by Email',
      url: 'https://webexapis.com/v1/people?email=mbgriffin@netsync.com',
      description: 'Search user by email (may show roles)'
    },
    {
      name: 'Organization Details',
      url: 'https://webexapis.com/v1/organizations',
      description: 'List organizations (admin required)'
    },
    {
      name: 'User Roles Endpoint',
      url: 'https://webexapis.com/v1/roles',
      description: 'List available roles (admin required)'
    }
  ];
  
  for (const check of roleChecks) {
    console.log(`📡 ${check.name}`);
    console.log(`   URL: ${check.url}`);
    console.log(`   Description: ${check.description}`);
    
    try {
      const response = await fetch(check.url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ SUCCESS`);
        
        // Look for roles in the response
        if (data.roles) {
          console.log(`   🔑 Roles found: ${JSON.stringify(data.roles)}`);
        }
        if (data.items && data.items.length > 0) {
          data.items.forEach((item, index) => {
            if (item.roles) {
              console.log(`   🔑 Item ${index} roles: ${JSON.stringify(item.roles)}`);
            }
            if (item.licenses) {
              console.log(`   📜 Item ${index} licenses: ${JSON.stringify(item.licenses)}`);
            }
          });
        }
        
        // Show first few characters of response for debugging
        const responseStr = JSON.stringify(data);
        console.log(`   📄 Response preview: ${responseStr.substring(0, 200)}...`);
        
      } else {
        const errorText = await response.text();
        console.log(`   ❌ FAILED: ${errorText.substring(0, 100)}...`);
      }
      
    } catch (error) {
      console.log(`   ❌ NETWORK ERROR: ${error.message}`);
    }
    
    console.log('');
  }
}

async function checkAdminCapabilities(accessToken) {
  console.log('🎯 TESTING SPECIFIC ADMIN CAPABILITIES\n');
  
  const adminTests = [
    {
      name: 'List Organization Users',
      url: 'https://webexapis.com/v1/people?max=5',
      capability: 'Organization Admin'
    },
    {
      name: 'Get Organization Info',
      url: 'https://webexapis.com/v1/organizations',
      capability: 'Organization Admin'
    },
    {
      name: 'List Licenses',
      url: 'https://webexapis.com/v1/licenses',
      capability: 'License Admin'
    },
    {
      name: 'Admin Meeting Transcripts',
      url: 'https://webexapis.com/v1/admin/meetingTranscripts?max=1',
      capability: 'Site Admin for Meetings'
    },
    {
      name: 'Admin Events',
      url: 'https://webexapis.com/v1/admin/events?max=1',
      capability: 'Organization Admin'
    }
  ];
  
  const capabilities = [];
  
  for (const test of adminTests) {
    console.log(`🔧 Testing: ${test.name}`);
    
    try {
      const response = await fetch(test.url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        console.log(`   ✅ HAS CAPABILITY: ${test.capability}`);
        capabilities.push(test.capability);
      } else {
        console.log(`   ❌ LACKS CAPABILITY: ${test.capability} (${response.status})`);
      }
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  }
  
  return capabilities;
}

async function main() {
  console.log('🔍 COMPREHENSIVE WEBEX USER ADMIN ROLE CHECK');
  console.log('============================================\n');
  
  const accessToken = await getSSMParameter('/PracticeTools/dev/WEBEX_MEETINGS_ACCESS_TOKEN');
  
  if (!accessToken) {
    console.log('❌ No access token found');
    process.exit(1);
  }
  
  console.log(`✅ Access token: ${accessToken.substring(0, 30)}...\n`);
  
  // First get user ID
  console.log('📡 Getting user ID...');
  const userResponse = await fetch('https://webexapis.com/v1/people/me', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!userResponse.ok) {
    console.log('❌ Failed to get user details');
    process.exit(1);
  }
  
  const userData = await userResponse.json();
  const userId = userData.id;
  console.log(`✅ User ID: ${userId}`);
  console.log(`✅ Email: ${userData.emails[0]}`);
  console.log(`✅ Display Name: ${userData.displayName}\n`);
  
  // Check roles via different methods
  await checkUserRoles(accessToken, userId);
  
  // Test admin capabilities
  const capabilities = await checkAdminCapabilities(accessToken);
  
  console.log('\n🎯 FINAL ANALYSIS:');
  console.log('==================');
  console.log(`User: ${userData.displayName} (${userData.emails[0]})`);
  console.log(`Detected Admin Capabilities: ${capabilities.length > 0 ? capabilities.join(', ') : 'None'}`);
  
  if (capabilities.includes('Site Admin for Meetings')) {
    console.log('✅ User HAS the required admin privileges for meeting:admin_transcripts_read');
  } else {
    console.log('❌ User LACKS the required admin privileges for meeting:admin_transcripts_read');
    console.log('   The user needs Site Admin or Organization Admin role for meeting transcripts');
  }
}

main().catch(console.error);