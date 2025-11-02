import { getValidAccessToken } from './lib/webex-token-manager.js';

async function testWebhookAPICall() {
  const roomId = 'Y2lzY29zcGFyazovL3VzL1JPT00vNDkwNmJhNDAtYjVhZS0xMWYwLWJkNmItYzU0NTEwMGE3OTU5';
  const siteUrl = 'netsync.webex.com';
  
  console.log('=== SIMULATING WEBHOOK API CALL ===\n');
  console.log('Room ID:', roomId);
  console.log('Site URL:', siteUrl);
  console.log('');
  
  console.log('Step 1: Getting access token via getValidAccessToken()...');
  const accessToken = await getValidAccessToken(siteUrl);
  console.log('✓ Token retrieved, length:', accessToken?.length);
  console.log('✓ Token first 50 chars:', accessToken?.substring(0, 50));
  console.log('');
  
  console.log('Step 2: Calling List Messages API...');
  const apiUrl = `https://webexapis.com/v1/messages?roomId=${roomId}&max=50`;
  console.log('URL:', apiUrl);
  console.log('Authorization:', `Bearer ${accessToken?.substring(0, 50)}...`);
  console.log('');
  
  const messagesResponse = await fetch(apiUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  console.log('Response status:', messagesResponse.status);
  console.log('Response headers:', Object.fromEntries(messagesResponse.headers.entries()));
  console.log('');
  
  if (!messagesResponse.ok) {
    const errorText = await messagesResponse.text();
    console.log('❌ API CALL FAILED');
    console.log('Error response:', errorText);
    return;
  }
  
  const messagesData = await messagesResponse.json();
  console.log('✓ API CALL SUCCESS');
  console.log('Messages returned:', messagesData.items?.length);
  console.log('First message ID:', messagesData.items?.[0]?.id);
}

testWebhookAPICall().catch(console.error);
