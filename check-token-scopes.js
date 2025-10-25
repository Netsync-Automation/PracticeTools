import { getSecureParameter } from './lib/ssm-config.js';

process.env.ENVIRONMENT = 'dev';

async function checkTokenScopes() {
  const accessToken = await getSecureParameter('/PracticeTools/dev/NETSYNC_WEBEX_MEETINGS_ACCESS_TOKEN');
  
  console.log('=== CHECKING ACCESS TOKEN SCOPES ===');
  
  // Get token info from Webex
  const response = await fetch('https://webexapis.com/v1/people/me', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  console.log('Response status:', response.status);
  console.log('Response headers:', Object.fromEntries(response.headers.entries()));
  
  if (!response.ok) {
    const errorText = await response.text();
    console.log('Error response:', errorText);
    return;
  }
  
  const data = await response.json();
  console.log('Token user info:', {
    id: data.id,
    emails: data.emails,
    displayName: data.displayName,
    orgId: data.orgId
  });
  
  // Try to decode the JWT token to see scopes (if it's a JWT)
  const tokenParts = accessToken.split('.');
  if (tokenParts.length === 3) {
    try {
      const payload = JSON.parse(atob(tokenParts[1]));
      console.log('\nToken payload:', payload);
      if (payload.scope) {
        console.log('Scopes:', payload.scope);
      }
    } catch (e) {
      console.log('Could not decode token as JWT');
    }
  }
  
  // Test specific API endpoints to see what permissions we have
  console.log('\n=== TESTING API PERMISSIONS ===');
  
  // Test recordings access
  const recordingsTest = await fetch('https://webexapis.com/v1/recordings?max=1', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  console.log('Recordings API access:', recordingsTest.status === 200 ? '✅ OK' : `❌ ${recordingsTest.status}`);
  
  // Test transcripts access
  const transcriptsTest = await fetch('https://webexapis.com/v1/meetingTranscripts?max=1', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  console.log('Transcripts API access:', transcriptsTest.status === 200 ? '✅ OK' : `❌ ${transcriptsTest.status}`);
  
  // Test webhooks access
  const webhooksTest = await fetch('https://webexapis.com/v1/webhooks', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  console.log('Webhooks API access:', webhooksTest.status === 200 ? '✅ OK' : `❌ ${webhooksTest.status}`);
}

checkTokenScopes().catch(console.error);