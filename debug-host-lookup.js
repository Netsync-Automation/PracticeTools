import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const region = 'us-east-1';
const ssm = new SSMClient({ region });

async function testHostLookup() {
    // This is the hostUserId from the recent webhook logs
    const hostUserId = "Y2lzY29zcGFyazovL3VzL1BFT1BMRS8wYmIzNDhiMC1iNDUwLTRiMTMtODE5NC1mMjEwYzFkZDMzNWI";
    
    console.log('Testing host lookup for:', hostUserId);
    
    try {
        console.log('Getting access token from SSM...');
        // Get access token
        const tokenParam = await ssm.send(new GetParameterCommand({
            Name: '/PracticeTools/dev/webex-meetings-access-token',
            WithDecryption: true
        }));
        
        const accessToken = tokenParam.Parameter.Value;
        console.log('Access token retrieved successfully, length:', accessToken?.length);
        
        // Call People API
        console.log('Making API call to:', `https://webexapis.com/v1/people/${hostUserId}`);
        
        const response = await fetch(`https://webexapis.com/v1/people/${hostUserId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('API Response Status:', response.status);
        console.log('API Response Status Text:', response.statusText);
        
        if (response.ok) {
            const userData = await response.json();
            console.log('User data:', JSON.stringify(userData, null, 2));
            console.log('Host email:', userData.emails?.[0]);
        } else {
            const errorText = await response.text();
            console.log('Error response body:', errorText);
            
            // Try to parse as JSON for better error details
            try {
                const errorJson = JSON.parse(errorText);
                console.log('Parsed error:', JSON.stringify(errorJson, null, 2));
            } catch (e) {
                console.log('Could not parse error as JSON');
            }
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testHostLookup().catch(console.error);