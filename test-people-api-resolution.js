import { getValidAccessToken } from './lib/webex-token-manager.js';

async function testPeopleApiResolution() {
    try {
        console.log('🔍 Testing People API resolution for netsync.webex.com...\n');
        
        // Get valid access token for the site
        const accessToken = await getValidAccessToken('netsync.webex.com');
        console.log('Access token obtained:', accessToken ? 'Yes' : 'No');
        
        if (!accessToken) {
            console.log('❌ No valid access token available');
            return;
        }
        
        const emails = ['mbgriffin@netsync.com', 'jengle@netsync.com'];
        
        for (const email of emails) {
            console.log(`\n📧 Resolving ${email}...`);
            
            try {
                const userResponse = await fetch(`https://webexapis.com/v1/people?email=${encodeURIComponent(email)}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                
                console.log(`People API response status: ${userResponse.status}`);
                
                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    console.log('Response data:', JSON.stringify(userData, null, 2));
                    
                    if (userData.items && userData.items.length > 0) {
                        console.log(`✅ Resolved ${email} to user ID: ${userData.items[0].id}`);
                    } else {
                        console.log(`❌ No user found for ${email}`);
                    }
                } else {
                    const errorText = await userResponse.text();
                    console.log(`❌ API error: ${errorText}`);
                }
            } catch (error) {
                console.error(`❌ Error resolving ${email}:`, error.message);
            }
        }
        
    } catch (error) {
        console.error('❌ Error in test:', error.message);
    }
}

testPeopleApiResolution();