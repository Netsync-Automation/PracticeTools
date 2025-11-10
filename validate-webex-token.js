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

async function validateToken() {
    try {
        console.log('Validating Webex access token...');
        
        const accessToken = await getSSMParameter('WEBEX_MEETINGS_ACCESS_TOKEN');
        if (!accessToken) {
            console.error('No access token found in SSM');
            return;
        }
        
        console.log(`Token found (first 20 chars): ${accessToken.substring(0, 20)}...`);
        
        // Test token by calling the /v1/people/me endpoint
        const response = await fetch('https://webexapis.com/v1/people/me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            console.error(`Token validation failed: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.error('Error details:', errorText);
            return;
        }
        
        const userData = await response.json();
        console.log('✅ Token is valid!');
        console.log('User info:', {
            id: userData.id,
            displayName: userData.displayName,
            emails: userData.emails
        });
        
        // Now test the People API with the specific user ID
        console.log('\nTesting People API with hostUserId...');
        const hostUserId = 'Y2lzY29zcGFyazovL3VzL1BFT1BMRS8wYmIzNDhiMC1iNDUwLTRiMTMtODE5NC1mMjEwYzFkZDMzNWI';
        
        const peopleResponse = await fetch(`https://webexapis.com/v1/people/${hostUserId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!peopleResponse.ok) {
            console.error(`People API failed: ${peopleResponse.status} ${peopleResponse.statusText}`);
            const errorText = await peopleResponse.text();
            console.error('Error details:', errorText);
            return;
        }
        
        const hostData = await peopleResponse.json();
        console.log('✅ People API works!');
        console.log('Host user data:', {
            id: hostData.id,
            displayName: hostData.displayName,
            emails: hostData.emails
        });
        
        if (hostData.emails && hostData.emails.length > 0) {
            console.log(`\n🎯 Host email: ${hostData.emails[0]}`);
        }
        
    } catch (error) {
        console.error('Validation error:', error);
    }
}

validateToken();