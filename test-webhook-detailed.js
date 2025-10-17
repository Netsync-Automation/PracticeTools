// Test webhook with more detailed error logging
const testPayload = {
  "id": "test-webhook-" + Date.now(),
  "name": "Test Webhook Event",
  "resource": "recordings", 
  "event": "created",
  "data": {
    "id": "test-recording-123",
    "hostUserId": "Y2lzY29zcGFyazovL3VzL1BFT1BMRS9tYmdyaWZmaW5AbmV0c3luYy5jb20" // Base64 encoded test user ID
  },
  "created": new Date().toISOString()
};

async function testWebhookDetailed() {
  console.log('=== DETAILED WEBHOOK TEST ===');
  console.log('Test payload:', JSON.stringify(testPayload, null, 2));
  
  try {
    const response = await fetch('http://localhost:3000/api/webex-meetings/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });
    
    console.log('\nWebhook Response Status:', response.status);
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Response Body:', responseText);
    
    // Try to parse as JSON for better formatting
    try {
      const responseJson = JSON.parse(responseText);
      console.log('Parsed Response:', JSON.stringify(responseJson, null, 2));
    } catch (e) {
      console.log('Response is not JSON');
    }
    
  } catch (error) {
    console.log('❌ Error calling webhook:', error.message);
    console.log('Stack:', error.stack);
  }
}

testWebhookDetailed().catch(console.error);