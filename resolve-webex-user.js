#!/usr/bin/env node

/**
 * Resolve Webex User ID to Email
 * Helps identify users from webhook events
 */

import { getValidAccessToken } from './lib/webex-token-manager.js';

async function resolveWebexUser(userId, siteUrl = 'netsync.webex.com') {
  console.log('🔍 Resolving Webex User ID to Email');
  console.log('=' .repeat(40));
  
  try {
    console.log(`\n👤 User ID: ${userId}`);
    console.log(`🌐 Site: ${siteUrl}`);
    
    // Get valid access token
    const accessToken = await getValidAccessToken(siteUrl);
    
    // Get user details from Webex API
    const response = await fetch(`https://webexapis.com/v1/people/${userId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!response.ok) {
      console.log(`❌ Failed to resolve user: ${response.status} ${response.statusText}`);
      return;
    }
    
    const userData = await response.json();
    
    console.log('\n✅ User Details:');
    console.log(`   Display Name: ${userData.displayName}`);
    console.log(`   Emails: ${userData.emails.join(', ')}`);
    console.log(`   User Type: ${userData.type}`);
    console.log(`   Status: ${userData.status}`);
    console.log(`   Organization ID: ${userData.orgId}`);
    
    console.log('\n💡 To allow this user to trigger recording processing:');
    console.log('   1. Go to Admin Settings > Webex Meetings');
    console.log('   2. Add their email to Recording Hosts:');
    console.log(`      ${userData.emails[0]}`);
    
  } catch (error) {
    console.error('❌ Error resolving user:', error.message);
  }
}

// Get user ID from command line or use the one from your webhook
const userId = process.argv[2] || 'Y2lzY29zcGFyazovL3VzL1BFT1BMRS8wYmIzNDhiMC1iNDUwLTRiMTMtODE5NC1mMjEwYzFkZDMzNWI';

resolveWebexUser(userId).catch(console.error);