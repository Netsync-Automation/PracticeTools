async function createWebhook(payload, name) {
  const accessToken = 'ODk2NzVhZmYtMjQ5Ny00NjEwLWIzOGQtMjM0ZWU3NThkMDdiMGEwNmE3MWItM2Ni_PF84_ca6f4958-d8d2-43cb-9766-93e41fa49150';
  
  console.log(`Creating ${name}...`);
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

    console.log('Response Status:', response.status, response.statusText);
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ ${name} created successfully!`);
      console.log('Webhook ID:', data.id);
      console.log('Status:', data.status, '\n');
      return data;
    } else {
      console.log(`❌ Failed to create ${name}`);
      console.log('Error:', JSON.stringify(data, null, 2), '\n');
      return null;
    }
  } catch (error) {
    console.error(`Error creating ${name}:`, error.message, '\n');
    return null;
  }
}

async function createLocalDevWebhooks() {
  console.log('=== CREATING LOCAL DEV WEBHOOKS ===\n');
  
  const recordingsPayload = {
    name: 'PracticeTools Local DevTest-Recordings',
    targetUrl: 'https://kazuko-diachronic-mundanely.ngrok-free.dev/api/webhooks/webexmeetings/recordings',
    resource: 'recordings',
    event: 'created'
  };
  
  const transcriptsPayload = {
    name: 'PracticeTools Local DevTest-Transcripts',
    targetUrl: 'https://kazuko-diachronic-mundanely.ngrok-free.dev/api/webhooks/webexmeetings/transcripts',
    resource: 'meetingTranscripts',
    event: 'created'
  };
  
  await createWebhook(recordingsPayload, 'Recordings Webhook');
  await createWebhook(transcriptsPayload, 'Transcripts Webhook');
  
  console.log('=== SETUP COMPLETE ===');
}

createLocalDevWebhooks();
