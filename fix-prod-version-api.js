#!/usr/bin/env node

// Script to fix production version table via API call
async function fixProdVersion() {
  console.log('🔧 PRODUCTION VERSION TABLE FIX VIA API');
  console.log('⚠️  This will revert production version table to v4.0.0');
  
  const PROD_APP_URL = 'https://issuestracker.netsync.com';
  const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'your-admin-api-key';
  
  try {
    console.log('\n1️⃣ Calling production API to fix version table...');
    
    const response = await fetch(`${PROD_APP_URL}/api/admin/fix-version-table`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'revert_to_v4',
        target_version: '4.0.0',
        reason: 'Remove dev versions accidentally added to production table'
      })
    });
    
    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('✅ API Response:', result);
    
    console.log('\n✅ PRODUCTION VERSION TABLE FIXED');
    console.log('🎯 Production should now show v4.0.0 as the latest version');
    
  } catch (error) {
    console.error('❌ Error calling production API:', error.message);
    console.log('\n📝 Manual fix required:');
    console.log('1. Access AWS Console → DynamoDB');
    console.log('2. Open table: PracticeTools-prod-Releases');
    console.log('3. Delete items with version: 5.0.0-dev.4 (and any other dev versions)');
    console.log('4. Ensure v4.0.0 exists as the latest production version');
  }
}

// Check if we have the API key
if (!process.env.ADMIN_API_KEY) {
  console.log('⚠️  ADMIN_API_KEY environment variable not set');
  console.log('📝 Manual fix instructions:');
  console.log('1. Access AWS Console → DynamoDB');
  console.log('2. Open table: PracticeTools-prod-Releases');
  console.log('3. Delete items with version: 5.0.0-dev.4 (and any other dev versions)');
  console.log('4. Ensure v4.0.0 exists as the latest production version');
  process.exit(1);
}

fixProdVersion();