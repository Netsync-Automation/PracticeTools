import { getValidAccessToken } from './lib/webex-token-manager.js';

async function checkToken() {
  try {
    const siteUrl = 'netsync.webex.com';
    console.log('Fetching token for:', siteUrl);
    
    const token = await getValidAccessToken(siteUrl);
    
    console.log('\n=== TOKEN INFO ===');
    console.log('Token length:', token?.length);
    console.log('Token first 50 chars:', token?.substring(0, 50));
    console.log('Full token:', token);
    
    // Test the token with the API
    const roomId = 'Y2lzY29zcGFyazovL3VzL1JPT00vNDkwNmJhNDAtYjVhZS0xMWYwLWJkNmItYzU0NTEwMGE3OTU5';
    console.log('\n=== TESTING API CALL ===');
    console.log('URL:', `https://webexapis.com/v1/messages?roomId=${roomId}&max=50`);
    
    const response = await fetch(`https://webexapis.com/v1/messages?roomId=${roomId}&max=50`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('Success! Message count:', data.items?.length);
    } else {
      const errorText = await response.text();
      console.log('Error response:', errorText);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkToken();
