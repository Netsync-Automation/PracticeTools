// Test webhook endpoint directly to see if it creates tables
const testPayload = {
  "id": "test-webhook-" + Date.now(),
  "name": "Test Webhook Event",
  "resource": "recordings", 
  "event": "created",
  "data": {
    "id": "test-recording-123",
    "hostUserId": "test-host-456"
  },
  "created": new Date().toISOString()
};

async function testWebhook() {
  console.log('=== TESTING WEBHOOK DIRECTLY ===');
  
  try {
    const response = await fetch('http://localhost:3000/api/webex-meetings/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });
    
    console.log('Webhook Response Status:', response.status);
    const responseText = await response.text();
    console.log('Webhook Response:', responseText);
    
    if (response.ok) {
      console.log('✅ Webhook endpoint is working');
      console.log('Check if WebexMeetingsLogs table was created in DynamoDB');
    } else {
      console.log('❌ Webhook endpoint returned error');
    }
  } catch (error) {
    console.log('❌ Error calling webhook:', error.message);
  }
}

testWebhook().catch(console.error);