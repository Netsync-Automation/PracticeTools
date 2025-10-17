import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssmClient = new SSMClient({ region: 'us-east-1' });

async function getSSMParameter(name) {
  const command = new GetParameterCommand({ Name: name, WithDecryption: true });
  const response = await ssmClient.send(command);
  return response.Parameter?.Value;
}

async function checkTokenSources() {
  const prefix = '/PracticeTools/dev';
  
  console.log('=== TOKEN SOURCE COMPARISON ===');
  
  // Check SSM
  const ssmToken = await getSSMParameter(`${prefix}/WEBEX_MEETINGS_ACCESS_TOKEN`);
  console.log('SSM Token:', ssmToken ? `${ssmToken.substring(0, 20)}...` : 'NOT FOUND');
  
  // Check environment variable (what App Runner sees)
  const envToken = process.env.WEBEX_MEETINGS_ACCESS_TOKEN;
  console.log('ENV Token:', envToken ? `${envToken.substring(0, 20)}...` : 'NOT FOUND');
  
  console.log('Tokens match:', ssmToken === envToken);
  
  // Test both tokens
  if (ssmToken) {
    console.log('\n=== TESTING SSM TOKEN ===');
    await testToken(ssmToken, 'SSM');
  }
  
  if (envToken && envToken !== ssmToken) {
    console.log('\n=== TESTING ENV TOKEN ===');
    await testToken(envToken, 'ENV');
  }
}

async function testToken(token, source) {
  try {
    const response = await fetch('https://webexapis.com/v1/people/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log(`${source} Token Status: ${response.status}`);
    if (response.status === 200) {
      const data = await response.json();
      console.log(`${source} Token Works: ${data.emails?.[0] || 'No email'}`);
    }
  } catch (error) {
    console.log(`${source} Token Error:`, error.message);
  }
}

checkTokenSources().catch(console.error);