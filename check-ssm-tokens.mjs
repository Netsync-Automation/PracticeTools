// Check what tokens are actually stored in SSM
import { SSMClient, GetParametersCommand } from '@aws-sdk/client-ssm';

const ssmClient = new SSMClient({ region: 'us-east-1' });

async function checkTokens() {
  try {
    console.log('🔍 Checking SSM parameters for Webex tokens...');
    
    const parameterNames = [
      '/PracticeTools/dev/NETSYNC_WEBEX_MEETINGS_ACCESS_TOKEN',
      '/PracticeTools/dev/NETSYNC_WEBEX_MEETINGS_REFRESH_TOKEN',
      '/PracticeTools/dev/NETSYNC_WEBEX_MEETINGS_CLIENT_ID',
      '/PracticeTools/dev/NETSYNC_WEBEX_MEETINGS_CLIENT_SECRET'
    ];
    
    const command = new GetParametersCommand({
      Names: parameterNames,
      WithDecryption: true
    });
    
    const result = await ssmClient.send(command);
    
    console.log('📋 Found parameters:', result.Parameters.length);
    
    for (const param of result.Parameters) {
      const value = param.Value;
      const preview = value.length > 20 ? value.substring(0, 20) + '...' : value;
      console.log(`${param.Name}: ${preview} (length: ${value.length})`);
    }
    
    if (result.InvalidParameters?.length > 0) {
      console.log('❌ Invalid/missing parameters:', result.InvalidParameters);
    }
    
  } catch (error) {
    console.error('💥 Error checking tokens:', error.message);
  }
}

checkTokens();