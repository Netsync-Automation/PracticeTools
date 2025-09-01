import fs from 'fs';
import path from 'path';

export async function updateAppRunnerYaml(ssmPrefix, environment = 'dev') {
  try {
    const yamlFile = environment === 'prod' ? 'apprunner-prod.yaml' : 'apprunner-dev.yaml';
    const yamlPath = path.join(process.cwd(), yamlFile);
    
    if (!fs.existsSync(yamlPath)) {
      console.log(`AppRunner YAML file not found: ${yamlPath}`);
      return false;
    }
    
    let yamlContent = fs.readFileSync(yamlPath, 'utf8');
    
    // Define the new environment variables to add
    const newEnvVars = [
      `    - name: WEBEX_${ssmPrefix}_ACCESS_TOKEN`,
      `      value-from: arn:aws:ssm:us-east-1:501399536130:parameter/PracticeTools/${environment === 'prod' ? '' : environment + '/'}WEBEX_${ssmPrefix}_ACCESS_TOKEN`,
      `    - name: WEBEX_${ssmPrefix}_ROOM_ID_1`,
      `      value-from: arn:aws:ssm:us-east-1:501399536130:parameter/PracticeTools/${environment === 'prod' ? '' : environment + '/'}WEBEX_${ssmPrefix}_ROOM_ID_1`,
      `    - name: WEBEX_${ssmPrefix}_ROOM_NAME`,
      `      value-from: arn:aws:ssm:us-east-1:501399536130:parameter/PracticeTools/${environment === 'prod' ? '' : environment + '/'}WEBEX_${ssmPrefix}_ROOM_NAME`
    ];
    
    // Check if these variables already exist
    const tokenVarExists = yamlContent.includes(`WEBEX_${ssmPrefix}_ACCESS_TOKEN`);
    
    if (tokenVarExists) {
      console.log(`WebEx environment variables for ${ssmPrefix} already exist in ${yamlFile}`);
      return true;
    }
    
    // Find the last secret entry and add new ones after it
    const secretsMatch = yamlContent.match(/(.*secrets:\s*\n(?:.*\n)*)/);
    if (secretsMatch) {
      const beforeSecrets = yamlContent.substring(0, secretsMatch.index + secretsMatch[1].length);
      const afterSecrets = yamlContent.substring(secretsMatch.index + secretsMatch[1].length);
      
      // Add new environment variables
      const updatedContent = beforeSecrets + newEnvVars.join('\n') + '\n' + afterSecrets;
      
      // Write back to file
      fs.writeFileSync(yamlPath, updatedContent, 'utf8');
      console.log(`Updated ${yamlFile} with WebEx environment variables for ${ssmPrefix}`);
      return true;
    } else {
      console.error(`Could not find secrets section in ${yamlFile}`);
      return false;
    }
  } catch (error) {
    console.error(`Error updating AppRunner YAML:`, error);
    return false;
  }
}