import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssmClient = new SSMClient({ region: 'us-east-1' });

async function getSSMParameter(name) {
  try {
    const command = new GetParameterCommand({
      Name: `/PracticeTools/dev/${name}`,
      WithDecryption: true
    });
    const response = await ssmClient.send(command);
    return response.Parameter.Value;
  } catch (error) {
    console.error(`Failed to get SSM parameter ${name}:`, error.message);
    return null;
  }
}

async function testTranscriptsByInstanceId() {
  console.log('🔍 Testing Webex transcript access by meeting instance ID...\n');
  
  const accessToken = await getSSMParameter('WEBEX_MEETINGS_ACCESS_TOKEN');
  if (!accessToken) {
    console.error('❌ No access token found');
    return;
  }

  // First, get recent meetings to find ended instance IDs
  console.log('📋 Fetching recent meetings to find instance IDs...');
  try {
    const meetingsResponse = await fetch('https://webexapis.com/v1/meetings?max=10&state=ended', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!meetingsResponse.ok) {
      console.error('❌ Failed to fetch meetings:', meetingsResponse.status, meetingsResponse.statusText);
      return;
    }

    const meetingsData = await meetingsResponse.json();
    console.log(`📊 Found ${meetingsData.items?.length || 0} ended meetings\n`);

    if (!meetingsData.items || meetingsData.items.length === 0) {
      console.log('ℹ️ No ended meetings found');
      return;
    }

    // Test transcript access for each meeting
    for (const meeting of meetingsData.items.slice(0, 5)) {
      console.log(`🎯 Testing meeting: ${meeting.title}`);
      console.log(`   Meeting ID: ${meeting.id}`);
      console.log(`   Host Email: ${meeting.hostEmail}`);
      console.log(`   Start Time: ${meeting.start}`);
      
      // Try to get transcripts using the meeting ID (which should be the instance ID for ended meetings)
      try {
        const transcriptResponse = await fetch(`https://webexapis.com/v1/meetingTranscripts?meetingId=${meeting.id}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        console.log(`   Transcript API Status: ${transcriptResponse.status}`);
        
        if (transcriptResponse.ok) {
          const transcriptData = await transcriptResponse.json();
          console.log(`   ✅ Transcripts found: ${transcriptData.items?.length || 0}`);
          
          if (transcriptData.items && transcriptData.items.length > 0) {
            const transcript = transcriptData.items[0];
            console.log(`   📝 Transcript ID: ${transcript.id}`);
            console.log(`   📄 VTT Link: ${transcript.vttDownloadLink ? 'Available' : 'Not available'}`);
            console.log(`   📄 TXT Link: ${transcript.txtDownloadLink ? 'Available' : 'Not available'}`);
          }
        } else {
          const errorData = await transcriptResponse.text();
          console.log(`   ❌ Error: ${errorData}`);
        }
      } catch (error) {
        console.log(`   ❌ Request failed: ${error.message}`);
      }
      
      console.log(''); // Empty line for readability
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Also test the admin endpoint if we have admin access
async function testAdminTranscripts() {
  console.log('\n🔐 Testing admin transcript access...\n');
  
  const accessToken = await getSSMParameter('WEBEX_MEETINGS_ACCESS_TOKEN');
  if (!accessToken) {
    console.error('❌ No access token found');
    return;
  }

  try {
    const adminResponse = await fetch('https://webexapis.com/v1/admin/meetingTranscripts?max=5', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`Admin API Status: ${adminResponse.status}`);
    
    if (adminResponse.ok) {
      const adminData = await adminResponse.json();
      console.log(`✅ Admin transcripts found: ${adminData.items?.length || 0}`);
      
      if (adminData.items && adminData.items.length > 0) {
        adminData.items.forEach((transcript, index) => {
          console.log(`${index + 1}. Meeting ID: ${transcript.meetingId}`);
          console.log(`   Transcript ID: ${transcript.id}`);
          console.log(`   Host Email: ${transcript.hostEmail}`);
        });
      }
    } else {
      const errorData = await adminResponse.text();
      console.log(`❌ Admin access error: ${errorData}`);
      console.log('ℹ️ This likely means the token lacks meeting:admin_transcripts_read scope');
    }
  } catch (error) {
    console.error('❌ Admin request failed:', error.message);
  }
}

// Run tests
testTranscriptsByInstanceId().then(() => {
  return testAdminTranscripts();
}).then(() => {
  console.log('\n✅ Transcript testing completed');
}).catch(error => {
  console.error('❌ Test failed:', error);
});