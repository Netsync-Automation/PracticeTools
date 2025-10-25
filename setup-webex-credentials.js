#!/usr/bin/env node

import { storeWebexCredentials } from './lib/ssm.js';

async function setupWebexCredentials() {
  console.log('🔧 Setting up Webex Client Credentials...\n');
  
  // For netsync.webex.com site
  const siteUrl = 'netsync.webex.com';
  
  // These would normally come from the Webex service app configuration
  // For now, we'll use placeholder values - you need to replace these with actual values
  const clientId = 'YOUR_CLIENT_ID_HERE';
  const clientSecret = 'YOUR_CLIENT_SECRET_HERE';
  
  if (clientId === 'YOUR_CLIENT_ID_HERE' || clientSecret === 'YOUR_CLIENT_SECRET_HERE') {
    console.log('❌ Please update the script with actual client credentials');
    console.log('   You can find these in your Webex service app configuration');
    console.log('   1. Go to https://developer.webex.com/my-apps');
    console.log('   2. Select your service app');
    console.log('   3. Copy the Client ID and Client Secret');
    return;
  }
  
  try {
    await storeWebexCredentials(siteUrl, clientId, clientSecret);
    console.log(`✅ Client credentials stored for ${siteUrl}`);
    console.log('   Now you can try refreshing tokens again');
  } catch (error) {
    console.error('❌ Failed to store credentials:', error);
  }
}

// Run the setup
setupWebexCredentials();