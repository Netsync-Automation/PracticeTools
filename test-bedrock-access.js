import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({ region: 'us-east-1' });

async function testBedrockAccess() {
  try {
    console.log('Testing AWS Bedrock access for Claude 3.5 Sonnet v2...\n');
    
    const modelId = 'anthropic.claude-3-5-sonnet-20240620-v1:0';
    console.log('Testing model:', modelId);
    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: 'Say "Hello, Bedrock is working!" if you can read this.'
        }
      ]
    };

    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload)
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    console.log('✅ SUCCESS! Bedrock access is enabled.');
    console.log('Model ID:', modelId);
    console.log('Response:', responseBody.content[0].text);
    console.log('\nYour ChatNPT feature is ready to use!');
    
  } catch (error) {
    console.error('❌ ERROR: Bedrock access test failed\n');
    
    if (error.name === 'AccessDeniedException') {
      console.error('Issue: Model access not enabled');
      console.error('Solution: Go to AWS Console → Bedrock → Model access → Enable Claude 3.5 Sonnet v2');
    } else if (error.name === 'ResourceNotFoundException') {
      console.error('Issue: Model not found in this region');
      console.error('Solution: Verify the model is available in us-east-1 region');
    } else {
      console.error('Error details:', error.message);
    }
    
    process.exit(1);
  }
}

testBedrockAccess();
