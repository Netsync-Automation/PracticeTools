import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

function updateAppRunnerSecrets(key) {
  const appRunnerPath = path.join(process.cwd(), 'apprunner.yaml');
  
  try {
    const yamlContent = fs.readFileSync(appRunnerPath, 'utf8');
    const config = yaml.load(yamlContent);
    
    if (!config.run.secrets) {
      config.run.secrets = [];
    }
    
    const existingSecret = config.run.secrets.find(secret => secret.name === key);
    
    if (!existingSecret) {
      config.run.secrets.push({
        name: key,
        'value-from': `arn:aws:ssm:us-east-1:501399536130:parameter/PracticeTools/${key}`
      });
      
      const updatedYaml = yaml.dump(config, { indent: 2 });
      fs.writeFileSync(appRunnerPath, updatedYaml);
    }
  } catch (error) {
    console.error('Error updating apprunner.yaml:', error);
  }
}

export function updateEnvVariable(key, value) {
  const envPath = path.join(process.cwd(), '.env.local');
  
  console.log('updateEnvVariable called:', { key, value, envPath });
  
  try {
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
      console.log('Current env content:', envContent);
    } else {
      console.log('Env file does not exist');
    }
    
    const lines = envContent.split('\n');
    let found = false;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith(`${key}=`)) {
        console.log(`Updating existing line ${i}`);
        // Handle multiline values (like certificates)
        if (key === 'DUO_CERTIFICATE') {
          // Remove old certificate lines
          let j = i;
          while (j < lines.length && (lines[j].startsWith(`${key}=`) || lines[j].startsWith('-----') || lines[j].match(/^[A-Za-z0-9+/=]+$/))) {
            lines.splice(j, 1);
          }
          // Insert new certificate
          lines.splice(i, 0, `${key}=${value}`);
        } else {
          lines[i] = `${key}=${value}`;
        }
        found = true;
        break;
      }
    }
    
    if (!found) {
      console.log('Adding new env variable:', `${key}=${value}`);
      lines.push(`${key}=${value}`);
      updateAppRunnerSecrets(key);
    }
    
    const newContent = lines.join('\n');
    console.log('Writing new content:', newContent);
    fs.writeFileSync(envPath, newContent);
    process.env[key] = value;
    console.log('Env variable updated successfully');
  } catch (error) {
    console.error('Error updating env variable:', error);
  }
}