// Test the exact same host lookup logic used in the webhook
async function getHostEmailFromUserId(hostUserId, accessToken) {
  try {
    console.log('Making API call to:', `https://webexapis.com/v1/people/${hostUserId}`);
    console.log('Access token length:', accessToken?.length);
    
    const response = await fetch(`https://webexapis.com/v1/people/${hostUserId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    
    if (response.ok) {
      const person = await response.json();
      console.log('Person data:', JSON.stringify(person, null, 2));
      console.log('Emails array:', person.emails);
      console.log('First email:', person.emails?.[0]);
      return person.emails?.[0] || null;
    } else {
      const errorText = await response.text();
      console.log('Error response:', errorText);
    }
    return null;
  } catch (error) {
    console.error('Error fetching host email:', error);
    return null;
  }
}

async function testWebhookHostLookup() {
  // Use environment variable like the webhook does
  const accessToken = process.env.WEBEX_MEETINGS_ACCESS_TOKEN;
  const hostUserId = "Y2lzY29zcGFyazovL3VzL1BFT1BMRS8wYmIzNDhiMC1iNDUwLTRiMTMtODE5NC1mMjEwYzFkZDMzNWI";
  
  console.log('Testing webhook host lookup...');
  console.log('Access token from env:', !!accessToken);
  
  if (!accessToken) {
    console.log('No WEBEX_MEETINGS_ACCESS_TOKEN environment variable found');
    return;
  }
  
  const hostEmail = await getHostEmailFromUserId(hostUserId, accessToken);
  console.log('Final result - hostEmail:', hostEmail);
}

testWebhookHostLookup().catch(console.error);