async function createLocalWebhook() {
  const accessToken = 'ODk2NzVhZmYtMjQ5Ny00NjEwLWIzOGQtMjM0ZWU3NThkMDdiMGEwNmE3MWItM2Ni_PF84_ca6f4958-d8d2-43cb-9766-93e41fa49150';
  
  const payload = {
    name: 'PracticeTools Local DevTest',
    targetUrl: 'https://kazuko-diachronic-mundanely.ngrok-free.dev/api/webhooks/webexmeetings/transcripts',
    resource: 'meetingTranscripts',
    event: 'created',
    secret: 'P!7xZ@r4eL9w#Vu1Tq&'
  };

  console.log('Creating webhook...');
  console.log('Payload:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await fetch('https://webexapis.com/v1/webhooks', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log('\nResponse Status:', response.status, response.statusText);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('\n✅ Webhook created successfully!');
      console.log('Webhook ID:', data.id);
    } else {
      console.log('\n❌ Failed to create webhook');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

createLocalWebhook();
