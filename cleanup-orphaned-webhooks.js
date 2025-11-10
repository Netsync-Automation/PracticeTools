import { getSecureParameter } from './lib/ssm-config.js';

process.env.ENVIRONMENT = 'dev';

async function cleanupOrphanedWebhooks() {
  const accessToken = await getSecureParameter('/PracticeTools/dev/NETSYNC_WEBEX_MEETINGS_ACCESS_TOKEN');
  
  console.log('=== FINDING ALL WEBHOOKS ===');
  
  const response = await fetch('https://webexapis.com/v1/webhooks', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  if (!response.ok) {
    console.log('Failed to get webhooks:', response.status);
    return;
  }
  
  const data = await response.json();
  console.log(`Found ${data.items.length} total webhooks`);
  
  // Find all transcript webhooks
  const transcriptWebhooks = data.items.filter(w => w.resource === 'meetingTranscripts');
  console.log(`\nFound ${transcriptWebhooks.length} transcript webhooks:`);
  
  for (const webhook of transcriptWebhooks) {
    console.log(`- ${webhook.name} (${webhook.id})`);
    console.log(`  Status: ${webhook.status}`);
    console.log(`  OwnedBy: ${webhook.ownedBy}`);
    console.log(`  TargetUrl: ${webhook.targetUrl}`);
    console.log(`  Created: ${webhook.created}`);
    
    // Delete all transcript webhooks to clean slate
    console.log(`  Deleting webhook ${webhook.id}...`);
    const deleteResponse = await fetch(`https://webexapis.com/v1/webhooks/${webhook.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (deleteResponse.ok) {
      console.log(`  ✅ Deleted successfully`);
    } else {
      console.log(`  ❌ Delete failed: ${deleteResponse.status}`);
    }
  }
  
  // Also check recording webhooks
  const recordingWebhooks = data.items.filter(w => w.resource === 'recordings');
  console.log(`\nFound ${recordingWebhooks.length} recording webhooks:`);
  
  for (const webhook of recordingWebhooks) {
    console.log(`- ${webhook.name} (${webhook.id})`);
    console.log(`  Status: ${webhook.status}`);
    console.log(`  OwnedBy: ${webhook.ownedBy}`);
    console.log(`  TargetUrl: ${webhook.targetUrl}`);
  }
  
  console.log('\n=== CLEANUP COMPLETE ===');
  console.log('You can now recreate the webhooks through the admin interface');
}

cleanupOrphanedWebhooks().catch(console.error);