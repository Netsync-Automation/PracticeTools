async function testValidateConfig() {
    try {
        console.log('🔍 Running validate config endpoint...\n');
        
        const response = await fetch('http://localhost:3000/api/webex-meetings/validate');
        
        if (!response.ok) {
            console.log(`❌ Validate endpoint failed: ${response.status}`);
            return;
        }
        
        const validation = await response.json();
        
        console.log('📊 Validation Results:');
        console.log(`   Environment: ${validation.environment}`);
        console.log(`   Base URL: ${validation.baseUrl}`);
        console.log(`   Redirect URI: ${validation.redirectUri}`);
        console.log(`   Scopes: ${validation.scopes}`);
        console.log(`   Client ID Present: ${validation.clientIdPresent}`);
        console.log(`   Client Secret Present: ${validation.clientSecretPresent}`);
        console.log(`   Access Token Present: ${validation.accessTokenPresent}`);
        
        if (validation.tokenValidation) {
            console.log('\n🎫 Token Validation:');
            console.log(`   Valid: ${validation.tokenValidation.valid}`);
            console.log(`   Has Required Scopes: ${validation.tokenValidation.hasRequiredScopes}`);
            if (validation.tokenValidation.error) {
                console.log(`   Error: ${validation.tokenValidation.error}`);
            }
        }
        
        if (validation.issues && validation.issues.length > 0) {
            console.log('\n⚠️  Issues Found:');
            validation.issues.forEach((issue, i) => {
                console.log(`   ${i + 1}. ${issue}`);
            });
        } else {
            console.log('\n✅ No issues found');
        }
        
        console.log('\n💡 The validate config only tests spark:people_read scope');
        console.log('   It does NOT test meeting:admin_transcripts_read scope');
        console.log('   This is why it shows as valid even without admin access');
        
    } catch (error) {
        console.error('Error:', error);
        console.log('\n⚠️  Could not reach validate endpoint (dev server may not be running)');
    }
}

testValidateConfig();