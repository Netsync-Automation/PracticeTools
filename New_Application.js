#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { SSMClient, PutParameterCommand, GetParameterCommand } from '@aws-sdk/client-ssm';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

// Load AWS credentials from .env.local
function loadEnvCredentials() {
  try {
    const envContent = readFileSync('.env.local', 'utf8');
    const envVars = {};
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        envVars[key] = value;
      }
    });
    return {
      accessKeyId: envVars.AWS_ACCESS_KEY_ID,
      secretAccessKey: envVars.AWS_SECRET_ACCESS_KEY,
      region: envVars.AWS_DEFAULT_REGION || 'us-east-1'
    };
  } catch (error) {
    console.error('❌ Error loading .env.local:', error.message);
    process.exit(1);
  }
}

// Get all files to update (excluding node_modules, .next, uploads)
function getAllFiles(dir, fileList = []) {
  const files = readdirSync(dir);
  
  files.forEach(file => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip these directories
      if (['node_modules', '.next', 'uploads', '.git'].includes(file)) {
        return;
      }
      getAllFiles(filePath, fileList);
    } else {
      // Only process these file types
      const ext = extname(file);
      if (['.js', '.json', '.md', '.yaml', '.yml', '.env'].includes(ext) || file === '.env.local') {
        fileList.push(filePath);
      }
    }
  });
  
  return fileList;
}

// Update file content
function updateFileContent(filePath, oldName, newName) {
  try {
    let content = readFileSync(filePath, 'utf8');
    let updated = false;
    
    // Replace all occurrences of PracticeTools with new name
    const regex = new RegExp('PracticeTools', 'g');
    if (regex.test(content)) {
      content = content.replace(regex, newName);
      updated = true;
    }
    
    // Also replace issue-tracker in S3 bucket names
    const bucketRegex = new RegExp('netsync-practicetools-bucket', 'g');
    if (bucketRegex.test(content)) {
      content = content.replace(bucketRegex, `netsync-${newName.toLowerCase()}-bucket`);
      updated = true;
    }
    
    if (updated) {
      writeFileSync(filePath, content, 'utf8');
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
    return false;
  }
}

// Create SSM parameters
async function createSSMParameter(ssmClient, parameterName, value, description = '') {
  try {
    const command = new PutParameterCommand({
      Name: parameterName,
      Value: value,
      Type: 'String',
      Description: description,
      Overwrite: true
    });
    
    await ssmClient.send(command);
    return true;
  } catch (error) {
    console.error(`❌ Error creating SSM parameter ${parameterName}:`, error.message);
    return false;
  }
}

// Verify SSM parameter exists
async function verifySSMParameter(ssmClient, parameterName) {
  try {
    const command = new GetParameterCommand({
      Name: parameterName
    });
    
    await ssmClient.send(command);
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('🚀 New Application Setup Script');
  console.log('================================');
  console.log('');
  
  // Step 1: Get new application name
  const newAppName = await question('Enter the new application name (e.g., PracticeTools): ');
  if (!newAppName || newAppName.trim() === '') {
    console.log('❌ Application name cannot be empty');
    rl.close();
    return;
  }
  
  console.log(`\\n📝 Using application name: ${newAppName}`);
  
  // Step 2: Update all file references
  console.log('\\n🔄 Updating file references...');
  const files = getAllFiles('.');
  let updatedFiles = [];
  
  files.forEach(file => {
    if (updateFileContent(file, 'PracticeTools', newAppName)) {
      updatedFiles.push(file);
      console.log(`✅ Updated: ${file}`);
    }
  });
  
  console.log(`\\n📊 Updated ${updatedFiles.length} files`);
  
  // Step 3: Create SSM parameters
  console.log('\\n🔧 Creating SSM parameters...');
  const credentials = loadEnvCredentials();
  const ssmClient = new SSMClient({
    region: credentials.region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey
    }
  });
  
  // SSM parameters to create (from apprunner files)
  const ssmParameters = [
    'WEBEX_SCOOP_ACCESS_TOKEN',
    'WEBEX_SCOOP_ROOM_ID_1', 
    'WEBEX_SCOOP_ROOM_NAME',
    'ADMIN_API_KEY',
    'CSRF_SECRET',
    'DEFAULT_TIMEZONE',
    'SSO_ENABLED',
    'DUO_METADATA_FILE',
    'DUO_ENTITY_ID',
    'DUO_CERT_FILE',
    'DUO_ACS',
    'SMTP_HOST',
    'SMTP_USERNAME',
    'SMTP_PW',
    'SMTP_PORT'
  ];
  
  // Get default values from .env.local
  const envContent = readFileSync('.env.local', 'utf8');
  const envVars = {};
  envContent.split('\\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      envVars[key] = value;
    }
  });
  
  let createdSSMs = [];
  
  // Create dev parameters
  console.log('\\n📋 Creating DEV SSM parameters...');
  for (const param of ssmParameters) {
    const paramName = `/${newAppName}/dev/${param}`;
    const defaultValue = envVars[param] || 'PLACEHOLDER_VALUE';
    
    if (await createSSMParameter(ssmClient, paramName, defaultValue, `${newAppName} dev environment - ${param}`)) {
      console.log(`✅ Created: ${paramName}`);
      createdSSMs.push(paramName);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Create prod parameters  
  console.log('\\n📋 Creating PROD SSM parameters...');
  for (const param of ssmParameters) {
    const paramName = `/${newAppName}/${param}`;
    const defaultValue = envVars[param] || 'PLACEHOLDER_VALUE';
    
    if (await createSSMParameter(ssmClient, paramName, defaultValue, `${newAppName} prod environment - ${param}`)) {
      console.log(`✅ Created: ${paramName}`);
      createdSSMs.push(paramName);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Step 4: Verify SSM creation
  console.log('\\n🔍 Verifying SSM parameters...');
  let allVerified = true;
  for (const paramName of createdSSMs) {
    if (await verifySSMParameter(ssmClient, paramName)) {
      console.log(`✅ Verified: ${paramName}`);
    } else {
      console.log(`❌ Failed to verify: ${paramName}`);
      allVerified = false;
    }
  }
  
  if (!allVerified) {
    console.log('\\n❌ Some SSM parameters failed verification. Please check AWS console.');
    rl.close();
    return;
  }
  
  // Step 5: Get additional configuration
  console.log('\\n⚙️ Additional Configuration Required:');
  
  const nextAuthUrlDev = await question('Enter NEXTAUTH_URL for DEV (e.g., https://dev-app.example.com): ');
  const nextAuthUrlProd = await question('Enter NEXTAUTH_URL for PROD (e.g., https://app.example.com): ');
  
  const adminEmail = await question('Enter DEFAULT_ADMIN_EMAIL [admin@localhost]: ') || 'admin@localhost';
  const adminPassword = await question('Enter DEFAULT_ADMIN_PASSWORD: ');
  const adminName = await question('Enter DEFAULT_ADMIN_NAME [Administrator]: ') || 'Administrator';
  
  // Create the additional SSM parameters
  const additionalParams = [
    { name: `/${newAppName}/dev/NEXTAUTH_URL`, value: nextAuthUrlDev },
    { name: `/${newAppName}/NEXTAUTH_URL`, value: nextAuthUrlProd },
    { name: `/${newAppName}/dev/DEFAULT_ADMIN_EMAIL`, value: adminEmail },
    { name: `/${newAppName}/DEFAULT_ADMIN_EMAIL`, value: adminEmail },
    { name: `/${newAppName}/dev/DEFAULT_ADMIN_PASSWORD`, value: adminPassword },
    { name: `/${newAppName}/DEFAULT_ADMIN_PASSWORD`, value: adminPassword },
    { name: `/${newAppName}/dev/DEFAULT_ADMIN_NAME`, value: adminName },
    { name: `/${newAppName}/DEFAULT_ADMIN_NAME`, value: adminName }
  ];
  
  console.log('\\n🔧 Creating additional SSM parameters...');
  for (const param of additionalParams) {
    const value = param.value || 'PLACEHOLDER_VALUE';
    if (await createSSMParameter(ssmClient, param.name, value)) {
      console.log(`✅ Created: ${param.name}`);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Step 6: Summary
  console.log('\\n🎉 APPLICATION SETUP COMPLETE!');
  console.log('================================');
  console.log(`\\n📱 Application Name: ${newAppName}`);
  console.log(`\\n📁 Files Updated: ${updatedFiles.length}`);
  console.log('   - DynamoDB table names updated');
  console.log('   - AppRunner YAML files updated');
  console.log('   - Environment variables updated');
  console.log('   - All code references updated');
  
  console.log(`\\n🔧 SSM Parameters Created: ${createdSSMs.length + additionalParams.length}`);
  console.log('   - DEV environment parameters');
  console.log('   - PROD environment parameters');
  console.log('   - Authentication configuration');
  
  console.log('\\n📋 New DynamoDB Tables (will be auto-created):');
  console.log(`   - ${newAppName}-dev-Issues`);
  console.log(`   - ${newAppName}-dev-Users`);
  console.log(`   - ${newAppName}-dev-Upvotes`);
  console.log(`   - ${newAppName}-dev-Comments`);
  console.log(`   - ${newAppName}-dev-Followers`);
  console.log(`   - ${newAppName}-dev-Settings`);
  console.log(`   - ${newAppName}-dev-StatusLog`);
  console.log(`   - ${newAppName}-dev-Releases`);
  console.log(`   - ${newAppName}-dev-Features`);
  console.log('   (Plus corresponding PROD tables)');
  
  console.log('\\n🚀 Next Steps:');
  console.log('   1. Commit and push your changes');
  console.log('   2. Deploy to AWS App Runner');
  console.log('   3. Update any additional SSM parameters as needed');
  console.log('   4. Test the application');
  
  rl.close();
}

main().catch(error => {
  console.error('❌ Script failed:', error);
  rl.close();
  process.exit(1);
});