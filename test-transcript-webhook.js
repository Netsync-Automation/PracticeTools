async function testTranscriptWebhook() {
  const url = 'https://czpifmw72k.us-east-1.awsapprunner.com/api/webhooks/webexmeetings/transcripts';
  
  const testPayload = {
    id: 'test-webhook-validation',
    name: 'Test Webhook',
    resource: 'meetingTranscripts',
    event: 'created',
    data: {
      id: 'test-transcript-id',
      meetingId: 'test-meeting-id',
      meetingInstanceId: 'test-instance-id',
      siteUrl: 'test-site',
      downloadUrl: 'https://example.com/test'
    }
  };

  console.log('Testing transcript webhook endpoint...');
  console.log('URL:', url);
  console.log('Payload:', JSON.stringify(testPayload, null, 2));
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    });

    console.log('\n=== RESPONSE ===');
    console.log('Status:', response.status, response.statusText);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Body:', responseText);
    
    if (response.ok) {
      console.log('\n✅ Endpoint is accessible and responding');
    } else {
      console.log('\n❌ Endpoint returned error status');
    }
  } catch (error) {
    console.error('\n❌ Failed to reach endpoint:', error.message);
  }
}

testTranscriptWebhook();
