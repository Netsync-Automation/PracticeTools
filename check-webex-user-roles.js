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

async function checkUserDetails(accessToken) {
  console.log('👤 CHECKING USER DETAILS AND ROLES\n');
  
  try {
    console.log('📡 Calling GET /v1/people/me...');
    const response = await fetch('https://webexapis.com/v1/people/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const userData = await response.json();
      console.log('\n✅ USER DETAILS:');
      console.log(`   Email: ${userData.emails?.[0] || 'N/A'}`);
      console.log(`   Display Name: ${userData.displayName || 'N/A'}`);
      console.log(`   ID: ${userData.id || 'N/A'}`);
      console.log(`   Org ID: ${userData.orgId || 'N/A'}`);
      console.log(`   Type: ${userData.type || 'N/A'}`);
      
      if (userData.roles && userData.roles.length > 0) {
        console.log('\n🔑 USER ROLES:');
        userData.roles.forEach(role => {
          console.log(`   - ${role}`);
        });
      } else {
        console.log('\n⚠️  NO ROLES FOUND');
      }
      
      if (userData.licenses && userData.licenses.length > 0) {
        console.log('\n📜 USER LICENSES:');
        userData.licenses.forEach(license => {
          console.log(`   - ${license}`);
        });
      } else {
        console.log('\n⚠️  NO LICENSES FOUND');
      }
      
      return userData;
    } else {
      const errorText = await response.text();
      console.log(`❌ Error: ${errorText}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ Network Error: ${error.message}`);
    return null;
  }
}

async function checkAvailableRoles(accessToken) {
  console.log('\n📋 CHECKING AVAILABLE ORG ROLES\n');
  
  try {
    console.log('📡 Calling GET /v1/roles...');
    const response = await fetch('https://webexapis.com/v1/roles', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const rolesData = await response.json();
      console.log('\n✅ AVAILABLE ROLES:');
      if (rolesData.items && rolesData.items.length > 0) {
        rolesData.items.forEach(role => {
          console.log(`   - ${role.name} (${role.id})`);
          if (role.description) {
            console.log(`     Description: ${role.description}`);
          }
        });
      } else {
        console.log('   No roles found');
      }
      
      return rolesData;
    } else {
      const errorText = await response.text();
      console.log(`❌ Error: ${errorText}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ Network Error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🔍 WEBEX USER ROLES AND PERMISSIONS CHECK');
  console.log('=========================================\n');
  
  const accessToken = await getSSMParameter('/PracticeTools/dev/WEBEX_MEETINGS_ACCESS_TOKEN');
  
  if (!accessToken) {
    console.log('❌ No access token found');
    process.exit(1);
  }
  
  console.log(`✅ Access token found (${accessToken.length} characters)`);
  console.log(`   Preview: ${accessToken.substring(0, 30)}...\n`);
  
  const userData = await checkUserDetails(accessToken);
  await checkAvailableRoles(accessToken);
  
  if (userData) {
    console.log('\n🎯 ADMIN PRIVILEGES ANALYSIS:');
    console.log('============================');
    
    const hasAdminRole = userData.roles && userData.roles.some(role => 
      role.toLowerCase().includes('admin') || 
      role.toLowerCase().includes('full') ||
      role.toLowerCase().includes('org')
    );
    
    const hasSiteAdmin = userData.roles && userData.roles.some(role => 
      role.toLowerCase().includes('site')
    );
    
    console.log(`   Has Admin Role: ${hasAdminRole ? '✅ YES' : '❌ NO'}`);
    console.log(`   Has Site Admin: ${hasSiteAdmin ? '✅ YES' : '❌ NO'}`);
    
    if (!hasAdminRole || !hasSiteAdmin) {
      console.log('\n⚠️  MISSING ADMIN PRIVILEGES:');
      console.log('   The user mbgriffin@netsync.com needs admin roles to access');
      console.log('   the meeting:admin_transcripts_read scope endpoints.');
      console.log('   Contact your Webex organization administrator to grant:');
      console.log('   - Organization Admin role');
      console.log('   - Site Admin role for the meeting site');
    } else {
      console.log('\n✅ USER HAS REQUIRED ADMIN PRIVILEGES');
    }
  }
}

main().catch(console.error);