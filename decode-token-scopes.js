import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssmClient = new SSMClient({ region: 'us-east-1' });

async function getSSMParameter(name) {
  const command = new GetParameterCommand({ Name: name, WithDecryption: true });
  const response = await ssmClient.send(command);
  return response.Parameter?.Value;
}

function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload;
  } catch (error) {
    return null;
  }
}

async function checkTokenScopes() {
  console.log('=== CHECKING ACTUAL TOKEN SCOPES ===');
  
  const prefix = '/PracticeTools/dev';
  const accessToken = await getSSMParameter(`${prefix}/WEBEX_MEETINGS_ACCESS_TOKEN`);
  
  if (!accessToken) {
    console.log('❌ No access token found in SSM');
    return;
  }
  
  console.log('✅ Access token found in SSM');
  console.log('Token prefix:', accessToken.substring(0, 20) + '...');
  
  // Decode JWT to see scopes
  const decoded = decodeJWT(accessToken);
  if (decoded) {
    console.log('\n📋 Token Details:');
    console.log('Issued at:', new Date(decoded.iat * 1000).toLocaleString());
    console.log('Expires at:', new Date(decoded.exp * 1000).toLocaleString());
    console.log('Issuer:', decoded.iss);
    console.log('Subject:', decoded.sub);
    
    if (decoded.scope) {
      console.log('\n🔑 Scopes in token:');
      const scopes = decoded.scope.split(' ');
      scopes.forEach(scope => {
        const hasScope = scope === 'spark:people_read' ? '✅' : '  ';
        console.log(`${hasScope} ${scope}`);
      });
      
      const hasRequiredScopes = [
        'spark:recordings_read',
        'meeting:recordings_read', 
        'meeting:transcripts_read',
        'spark:people_read'
      ].every(required => scopes.includes(required));
      
      console.log('\n📊 Scope Analysis:');
      console.log('Has spark:people_read:', scopes.includes('spark:people_read') ? '✅ YES' : '❌ NO');
      console.log('Has all required scopes:', hasRequiredScopes ? '✅ YES' : '❌ NO');
    } else {
      console.log('\n❌ No scope information found in token');
    }
  } else {
    console.log('\n❌ Could not decode token (might not be JWT format)');
  }
  
  // Test the token with People API
  console.log('\n🧪 Testing token with People API:');
  try {
    const response = await fetch('https://webexapis.com/v1/people/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    console.log('People API Status:', response.status);
    if (response.status === 200) {
      const data = await response.json();
      console.log('✅ People API works - Email:', data.emails?.[0] || 'No email');
    } else if (response.status === 403) {
      console.log('❌ People API forbidden - Missing spark:people_read scope');
    } else {
      console.log('❌ People API error:', response.status);
    }
  } catch (error) {
    console.log('❌ People API test failed:', error.message);
  }
}

checkTokenScopes().catch(console.error);