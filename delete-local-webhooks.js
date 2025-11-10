async function deleteWebhook(webhookId, name) {
  const accessToken = 'ODk2NzVhZmYtMjQ5Ny00NjEwLWIzOGQtMjM0ZWU3NThkMDdiMGEwNmE3MWItM2Ni_PF84_ca6f4958-d8d2-43cb-9766-93e41fa49150';
  
  console.log(`Deleting ${name}...`);
  console.log(`Webhook ID: ${webhookId}`);
  
  try {
    const response = await fetch(`https://webexapis.com/v1/webhooks/${webhookId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    console.log('Response Status:', response.status, response.statusText);
    
    if (response.status === 204) {
      console.log(`✅ ${name} deleted successfully!\n`);
      return true;
    } else {
      const data = await response.text();
      console.log('Response:', data);
      console.log(`❌ Failed to delete ${name}\n`);
      return false;
    }
  } catch (error) {
    console.error(`Error deleting ${name}:`, error.message, '\n');
    return false;
  }
}

async function deleteLocalWebhooks() {
  console.log('=== DELETING LOCAL DEV WEBHOOKS ===\n');
  
  const transcriptWebhookId = 'Y2lzY29zcGFyazovL3VzL1dFQkhPT0svNDViNzBhNGMtMjNkNy00NGE3LTlhMjYtMjE0Mjk2MjdhNGJk';
  const recordingWebhookId = 'Y2lzY29zcGFyazovL3VzL1dFQkhPT0svYTVkZmM5MWUtYjNiYS00N2UwLTk0MDUtNTRmNDUwYjZjNjFm';
  
  await deleteWebhook(transcriptWebhookId, 'Transcript Webhook');
  await deleteWebhook(recordingWebhookId, 'Recording Webhook');
  
  console.log('=== CLEANUP COMPLETE ===');
}

deleteLocalWebhooks();
