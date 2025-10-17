import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssm = new SSMClient({ region: process.env.AWS_DEFAULT_REGION || 'us-east-1' });

function getEnvironment() {
    return process.env.ENVIRONMENT === 'prod' ? 'prod' : 'dev';
}

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

async function decodeToken() {
    try {
        console.log('Checking Webex access token scopes...');
        
        const accessToken = await getSSMParameter('WEBEX_MEETINGS_ACCESS_TOKEN');
        if (!accessToken) {
            console.error('No access token found in SSM');
            return;
        }
        
        console.log(`Token found (first 20 chars): ${accessToken.substring(0, 20)}...`);
        
        // Use Webex's token introspection endpoint
        const response = await fetch('https://webexapis.com/v1/access_token', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!response.ok) {
            console.error(`Token introspection failed: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.error('Error details:', errorText);
            
            // Try alternative approach - test individual endpoints
            console.log('\nTesting individual API endpoints...');
            
            // Test recordings endpoint
            const recordingsTest = await fetch('https://webexapis.com/v1/recordings?max=1', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            console.log(`Recordings API: ${recordingsTest.status} ${recordingsTest.statusText}`);
            
            // Test people/me endpoint
            const peopleTest = await fetch('https://webexapis.com/v1/people/me', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            console.log(`People/me API: ${peopleTest.status} ${peopleTest.statusText}`);
            
            // Test specific people endpoint
            const specificPeopleTest = await fetch('https://webexapis.com/v1/people/Y2lzY29zcGFyazovL3VzL1BFT1BMRS8wYmIzNDhiMC1iNDUwLTRiMTMtODE5NC1mMjEwYzFkZDMzNWI', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            console.log(`Specific People API: ${specificPeopleTest.status} ${specificPeopleTest.statusText}`);
            
            return;
        }
        
        const tokenInfo = await response.json();
        console.log('Token info:', JSON.stringify(tokenInfo, null, 2));
        
    } catch (error) {
        console.error('Token decode error:', error);
    }
}

decodeToken();