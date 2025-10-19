import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

async function checkTokenScopes() {
  const ssmClient = new SSMClient({ region: 'us-east-1' });
  
  try {
    // Get the access token from SSM
    const command = new GetParameterCommand({
      Name: '/PracticeTools/dev/WEBEX_MEETINGS_ACCESS_TOKEN',
      WithDecryption: true
    });
    
    const response = await ssmClient.send(command);
    const accessToken = response.Parameter.Value;
    
    if (!accessToken) {
      console.log('❌ No access token found in SSM');
      return;
    }
    
    console.log('✅ Access token found in SSM');
    console.log('Token length:', accessToken.length);
    console.log('Token prefix:', accessToken.substring(0, 20) + '...');
    
    // Make a request to Webex API to get token info
    const tokenInfoResponse = await fetch('https://webexapis.com/v1/people/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (tokenInfoResponse.ok) {
      const userInfo = await tokenInfoResponse.json();
      console.log('✅ Token is valid');
      console.log('User:', userInfo.displayName, '(' + userInfo.emails[0] + ')');
      
      // Check what scopes we can access by testing different endpoints
      console.log('\n🔍 Testing token scopes:');
      
      // Test meetings scope
      const meetingsResponse = await fetch('https://webexapis.com/v1/meetings', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (meetingsResponse.ok) {
        console.log('✅ Meetings scope: GRANTED');
      } else {
        console.log('❌ Meetings scope: DENIED (' + meetingsResponse.status + ')');
      }
      
      // Test rooms scope
      const roomsResponse = await fetch('https://webexapis.com/v1/rooms', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (roomsResponse.ok) {
        console.log('✅ Rooms scope: GRANTED');
      } else {
        console.log('❌ Rooms scope: DENIED (' + roomsResponse.status + ')');
      }
      
    } else {
      console.log('❌ Token is invalid or expired');
      console.log('Status:', tokenInfoResponse.status);
      const errorText = await tokenInfoResponse.text();
      console.log('Error:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Error checking token:', error.message);
  }
}

checkTokenScopes();