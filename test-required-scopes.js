import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssmClient = new SSMClient({ region: 'us-east-1' });

async function testRequiredScopes() {
  try {
    const response = await ssmClient.send(new GetParameterCommand({
      Name: '/PracticeTools/dev/WEBEX_MEETINGS_ACCESS_TOKEN',
      WithDecryption: true
    }));
    
    const accessToken = response.Parameter.Value;
    console.log('✅ Token found, length:', accessToken.length);
    
    const tests = [
      { name: 'spark:people_read', url: 'https://webexapis.com/v1/people/me' },
      { name: 'spark:recordings_read', url: 'https://webexapis.com/v1/recordings?max=1' },
      { name: 'meeting:recordings_read', url: 'https://webexapis.com/v1/recordings?max=1' },
      { name: 'meeting:transcripts_read', url: 'https://webexapis.com/v1/meetingTranscripts?max=1' },
      { name: 'meeting:admin_transcripts_read', url: 'https://webexapis.com/v1/admin/meetingTranscripts?max=1' }
    ];
    
    for (const test of tests) {
      const response = await fetch(test.url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      const status = response.ok ? '✅ GRANTED' : `❌ DENIED (${response.status})`;
      console.log(`${test.name}: ${status}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testRequiredScopes();