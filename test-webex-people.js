import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

// Configure AWS
const ssm = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

// Get environment
function getEnvironment() {
    return process.env.ENVIRONMENT === 'prod' ? 'prod' : 'dev';
}

// Get SSM parameter
async function getSSMParameter(name) {
    const env = getEnvironment();
    const paramName = env === 'prod' ? `/PracticeTools/${name}` : `/PracticeTools/${env}/${name}`;
    
    try {
        const command = new GetParameterCommand({ Name: paramName });
        const result = await ssm.send(command);
        return result.Parameter.Value;
    } catch (error) {
        console.error(`Error getting SSM parameter ${paramName}:`, error.message);
        return null;
    }
}

// Test Webex People API
async function testWebexPeopleAPI() {
    try {
        console.log('Testing Webex People API...');
        
        // Get access token
        const accessToken = await getSSMParameter('WEBEX_MEETINGS_ACCESS_TOKEN');
        if (!accessToken) {
            console.error('No access token found');
            return;
        }
        
        // Test with the hostUserId from webhook logs
        const hostUserId = 'Y2lzY29zcGFyazovL3VzL1BFT1BMRS8wYmIzNDhiMC1iNDUwLTRiMTMtODE5NC1mMjEwYzFkZDMzNWI';
        
        console.log(`Looking up user: ${hostUserId}`);
        
        const response = await fetch(`https://webexapis.com/v1/people/${hostUserId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            console.error(`API Error: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.error('Error details:', errorText);
            return;
        }
        
        const userData = await response.json();
        console.log('User data:', JSON.stringify(userData, null, 2));
        
        if (userData.emails && userData.emails.length > 0) {
            console.log(`Primary email: ${userData.emails[0]}`);
        } else {
            console.log('No email found in user data');
        }
        
    } catch (error) {
        console.error('Error testing Webex People API:', error);
    }
}

// Run the test
testWebexPeopleAPI();