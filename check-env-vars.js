// Check what environment variables are actually available
async function checkEnvVars() {
  console.log('=== ENVIRONMENT VARIABLES CHECK ===');
  
  const webexVars = [
    'WEBEX_MEETINGS_CLIENT_ID',
    'WEBEX_MEETINGS_CLIENT_SECRET', 
    'WEBEX_MEETINGS_ACCESS_TOKEN',
    'WEBEX_MEETINGS_REFRESH_TOKEN'
  ];
  
  console.log('Webex Environment Variables:');
  webexVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`✅ ${varName}: ${value.substring(0, 20)}...`);
    } else {
      console.log(`❌ ${varName}: NOT SET`);
    }
  });
  
  console.log('\nOther relevant variables:');
  console.log('ENVIRONMENT:', process.env.ENVIRONMENT);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('AWS_DEFAULT_REGION:', process.env.AWS_DEFAULT_REGION);
}

async function testWebhookCall() {
  console.log('\n=== TESTING WEBHOOK ENDPOINT ===');
  
  try {
    const response = await fetch('http://localhost:3000/api/webex-meetings/check-env', {
      method: 'GET'
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Webhook environment check:', data);
    } else {
      console.log('Webhook environment check failed:', response.status);
    }
  } catch (error) {
    console.log('Could not reach webhook environment check');
  }
}

checkEnvVars();
testWebhookCall();