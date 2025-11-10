import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssmClient = new SSMClient({ region: 'us-east-1' });

async function getSSMParameter(name) {
  const command = new GetParameterCommand({ Name: name, WithDecryption: true });
  const response = await ssmClient.send(command);
  return response.Parameter?.Value;
}

async function testToken(token, label) {
  try {
    const response = await fetch('https://webexapis.com/v1/people/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const result = {
      label,
      status: response.status,
      tokenPrefix: token.substring(0, 20),
      hasScope: response.status === 200
    };
    
    if (response.status === 200) {
      const data = await response.json();
      result.email = data.emails?.[0];
    }
    
    return result;
  } catch (error) {
    return { label, error: error.message, tokenPrefix: token.substring(0, 20) };
  }
}

async function trackTokens() {
  console.log('=== TOKEN TRACKING ===');
  console.log('Time:', new Date().toISOString());
  
  const ssmToken = await getSSMParameter('/PracticeTools/dev/WEBEX_MEETINGS_ACCESS_TOKEN');
  
  if (ssmToken) {
    const result = await testToken(ssmToken, 'SSM');
    console.log('SSM Token Result:', JSON.stringify(result, null, 2));
    
    // Log to file for tracking changes over time
    const logEntry = {
      timestamp: new Date().toISOString(),
      tokenPrefix: ssmToken.substring(0, 20),
      status: result.status,
      hasScope: result.hasScope
    };
    
    console.log('Log Entry:', JSON.stringify(logEntry));
  } else {
    console.log('No SSM token found');
  }
}

trackTokens().catch(console.error);