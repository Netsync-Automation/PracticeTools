import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssmClient = new SSMClient({ region: 'us-east-1' });

async function diagnoseTranscriptWebhooks() {
  try {
    const response = await ssmClient.send(new GetParameterCommand({
      Name: '/PracticeTools/dev/WEBEX_MEETINGS_ACCESS_TOKEN',
      WithDecryption: true
    }));
    
    const accessToken = response.Parameter.Value;
    console.log('🔍 Diagnosing Webex Transcript Webhook Issues\n');
    
    // Issue #1: Check scopes
    console.log('1️⃣ Checking token scopes...');
    const scopeTests = [
      { name: 'meeting:transcripts_read', url: 'https://webexapis.com/v1/meetingTranscripts?max=1' },
      { name: 'meeting:admin_transcripts_read', url: 'https://webexapis.com/v1/admin/meetingTranscripts?max=1' }
    ];
    
    for (const test of scopeTests) {
      const res = await fetch(test.url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      console.log(`   ${test.name}: ${res.ok ? '✅ GRANTED' : `❌ DENIED (${res.status})`}`);
    }
    
    // Issue #5: Check webhook status
    console.log('\n5️⃣ Checking webhook status...');
    const webhooksRes = await fetch('https://webexapis.com/v1/webhooks', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (webhooksRes.ok) {
      const webhooksData = await webhooksRes.json();
      const transcriptWebhooks = webhooksData.items.filter(w => 
        w.resource === 'meetingTranscripts' && w.event === 'created'
      );
      
      console.log(`   Found ${transcriptWebhooks.length} transcript webhooks:`);
      transcriptWebhooks.forEach(w => {
        console.log(`   - ${w.name}: ${w.status} (${w.targetUrl})`);
        if (w.status !== 'active') {
          console.log(`     ⚠️  Webhook is ${w.status} - needs to be reactivated`);
        }
      });
    } else {
      console.log(`   ❌ Failed to fetch webhooks: ${webhooksRes.status}`);
    }
    
    // Issue #6: Check webhook ownership and filters
    console.log('\n6️⃣ Checking webhook ownership...');
    if (webhooksRes.ok) {
      const webhooksData = await webhooksRes.json();
      const transcriptWebhooks = webhooksData.items.filter(w => 
        w.resource === 'meetingTranscripts' && w.event === 'created'
      );
      
      transcriptWebhooks.forEach(w => {
        console.log(`   Webhook: ${w.name}`);
        console.log(`   - ownedBy: ${w.ownedBy || 'creator'}`);
        console.log(`   - filter: ${w.filter || 'none'}`);
        if (w.ownedBy === 'org') {
          console.log(`   ✅ Org-level webhook (will receive all org events)`);
        } else {
          console.log(`   ⚠️  User-level webhook (only events visible to token owner)`);
        }
      });
    }
    
    console.log('\n📋 RECOMMENDATIONS:');
    console.log('• If meeting:admin_transcripts_read is denied, you need org admin privileges');
    console.log('• Check Control Hub → Meeting Site → Settings → "Create recording transcripts"');
    console.log('• Verify meetings have transcription enabled in user settings');
    console.log('• If using AI Assistant, transcripts may not trigger classic webhooks');
    console.log('• Re-authorize with prompt=consent to get missing scopes');
    
  } catch (error) {
    console.error('❌ Diagnostic error:', error.message);
  }
}

diagnoseTranscriptWebhooks();