#!/usr/bin/env node

/**
 * Test People API Email to User ID Resolution
 * Tests the exact logic used in settings API
 */

import { getValidAccessToken } from './lib/webex-token-manager.js';

async function testPeopleAPI() {
  console.log('🔍 Testing People API Email to User ID Resolution');
  console.log('=' .repeat(55));
  
  const testEmails = [
    'mbgriffin@netsync.com',
    'jengle@netsync.com'
  ];
  
  const siteUrl = 'netsync.webex.com';
  
  try {
    console.log(`\n🌐 Site: ${siteUrl}`);
    console.log('📧 Test Emails:', testEmails.join(', '));
    
    // Get access token
    console.log('\n🔑 Getting access token...');
    const accessToken = await getValidAccessToken(siteUrl);
    console.log(`✅ Access token obtained: ${accessToken.substring(0, 20)}...`);
    
    // Test each email
    for (const email of testEmails) {
      console.log(`\n👤 Testing: ${email}`);
      console.log('-'.repeat(30));
      
      try {
        const url = `https://webexapis.com/v1/people?email=${encodeURIComponent(email)}`;
        console.log(`📡 API Call: ${url}`);
        
        const userResponse = await fetch(url, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        console.log(`📊 Response Status: ${userResponse.status} ${userResponse.statusText}`);
        
        if (userResponse.ok) {
          const userData = await userResponse.json();
          console.log(`📋 Response Data:`, {
            itemsCount: userData.items?.length || 0,
            hasItems: !!userData.items?.length
          });
          
          if (userData.items && userData.items.length > 0) {
            const user = userData.items[0];
            console.log(`✅ User Found:`);
            console.log(`   ID: ${user.id}`);
            console.log(`   Display Name: ${user.displayName}`);
            console.log(`   Emails: ${user.emails?.join(', ')}`);
            console.log(`   Type: ${user.type}`);
            console.log(`   Status: ${user.status}`);
            
            // Test the exact logic from settings API
            const hostEntry = { email };
            hostEntry.userId = user.id;
            
            console.log(`🎯 Result Object:`, hostEntry);
            console.log(`✅ Conversion successful: ${email} → ${user.id}`);
          } else {
            console.log(`❌ No user found for email: ${email}`);
            console.log(`📋 Full response:`, JSON.stringify(userData, null, 2));
          }
        } else {
          const errorText = await userResponse.text();
          console.log(`❌ API Error: ${userResponse.status}`);
          console.log(`📋 Error Details: ${errorText}`);
        }
      } catch (error) {
        console.log(`❌ Request Error: ${error.message}`);
      }
    }
    
    // Test the complete conversion logic
    console.log(`\n🧪 Testing Complete Conversion Logic`);
    console.log('=' .repeat(40));
    
    const resolvedHosts = await Promise.all(
      testEmails.map(async (email) => {
        const hostEntry = { email };
        
        if (email.includes('@')) {
          try {
            console.log(`🔄 Resolving: ${email}`);
            const userResponse = await fetch(`https://webexapis.com/v1/people?email=${encodeURIComponent(email)}`, {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            
            if (userResponse.ok) {
              const userData = await userResponse.json();
              if (userData.items && userData.items.length > 0) {
                hostEntry.userId = userData.items[0].id;
                console.log(`✅ Resolved: ${email} → ${hostEntry.userId}`);
              }
            }
          } catch (error) {
            console.log(`❌ Error: ${error.message}`);
          }
        }
        
        return hostEntry;
      })
    );
    
    console.log(`\n🎯 Final Results:`);
    resolvedHosts.forEach((host, index) => {
      console.log(`   Host ${index + 1}:`);
      console.log(`      Email: ${host.email}`);
      console.log(`      User ID: ${host.userId || 'Not resolved'}`);
      console.log(`      Status: ${host.userId ? '✅ Ready' : '❌ Failed'}`);
    });
    
    const allResolved = resolvedHosts.every(host => host.userId);
    console.log(`\n📊 Summary:`);
    console.log(`   Total Emails: ${testEmails.length}`);
    console.log(`   Resolved: ${resolvedHosts.filter(h => h.userId).length}`);
    console.log(`   Failed: ${resolvedHosts.filter(h => !h.userId).length}`);
    console.log(`   Success Rate: ${allResolved ? '100%' : 'Partial'}`);
    
    if (allResolved) {
      console.log(`\n✅ All emails successfully resolved to user IDs!`);
      console.log(`✅ Settings API should work correctly`);
    } else {
      console.log(`\n⚠️  Some emails could not be resolved`);
      console.log(`⚠️  Check user permissions and email validity`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testPeopleAPI().catch(console.error);