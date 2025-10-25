import { getValidAccessToken } from './lib/webex-token-manager.js';
import { getWebexCredentials } from './lib/ssm.js';

async function testSaveWithDebug() {
    try {
        console.log('🧪 Testing save operation with debug logging...\n');
        
        // Get current tokens and credentials
        const accessToken = await getValidAccessToken('netsync.webex.com');
        const credentials = await getWebexCredentials('netsync.webex.com');
        
        if (!accessToken || !credentials) {
            console.log('❌ Missing tokens or credentials');
            return;
        }
        
        // Simulate the data that would be sent from the frontend
        const testData = {
            enabled: true,
            sites: [{
                siteUrl: 'netsync.webex.com',
                siteName: 'netsync',
                accessToken: accessToken,
                refreshToken: 'dummy-refresh-token', // This would come from the form
                clientId: credentials.clientId,
                clientSecret: credentials.clientSecret,
                recordingHosts: [
                    'mbgriffin@netsync.com',
                    'jengle@netsync.com'
                ]
            }]
        };
        
        console.log('📤 Sending test data to API:', JSON.stringify(testData, null, 2));
        
        // Make the API call
        const response = await fetch('http://localhost:3000/api/settings/webex-meetings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testData)
        });
        
        console.log('\n📥 API Response Status:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ API Response:', result);
        } else {
            const error = await response.text();
            console.log('❌ API Error:', error);
        }
        
    } catch (error) {
        console.error('❌ Test error:', error.message);
    }
}

testSaveWithDebug();