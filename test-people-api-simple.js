import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const region = 'us-east-1';
const ssm = new SSMClient({ region });

async function testPeopleAPI() {
    try {
        console.log('1. Getting access token...');
        
        const tokenParam = await ssm.send(new GetParameterCommand({
            Name: '/PracticeTools/dev/WEBEX_MEETINGS_ACCESS_TOKEN',
            WithDecryption: true
        }));
        
        const accessToken = tokenParam.Parameter.Value;
        console.log('✓ Access token retrieved');
        
        // Test 1: Get current user info (should always work)
        console.log('\\n2. Testing /v1/people/me endpoint...');
        const meResponse = await fetch('https://webexapis.com/v1/people/me', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        console.log('Status:', meResponse.status);
        if (meResponse.ok) {
            const meData = await meResponse.json();
            console.log('✓ Current user:', meData.displayName, '(' + meData.emails[0] + ')');
        } else {
            console.log('✗ Failed to get current user');
            const errorText = await meResponse.text();
            console.log('Error:', errorText);
        }
        
        // Test 2: Try the problematic hostUserId
        console.log('\\n3. Testing problematic hostUserId...');
        const problemUserId = "Y2lzY29zcGFyazovL3VzL1BFT1BMRS8wYmIzNDhiMC1iNDUwLTRiMTMtODE5NC1mMjEwYzFkZDMzNWI";
        
        const userResponse = await fetch(`https://webexapis.com/v1/people/${problemUserId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        console.log('Status:', userResponse.status);
        if (userResponse.ok) {
            const userData = await userResponse.json();
            console.log('✓ User found:', userData.displayName, '(' + (userData.emails?.[0] || 'no email') + ')');
        } else {
            console.log('✗ User lookup failed');
            const errorText = await userResponse.text();
            console.log('Error response:', errorText);
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testPeopleAPI().catch(console.error);