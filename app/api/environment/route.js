import { readFileSync } from 'fs';
import yaml from 'js-yaml';

export async function GET() {
  try {
    console.log('Environment API called');
    // Read environment from apprunner.yaml as single source of truth
    const apprunnerContent = readFileSync('apprunner.yaml', 'utf8');
    const config = yaml.load(apprunnerContent);
    
    const envVars = config.run?.env || [];
    const environmentVar = envVars.find(env => env.name === 'ENVIRONMENT');
    const environment = environmentVar?.value || 'dev';
    
    console.log('Environment API returning:', environment);
    
    return Response.json({ 
      environment,
      source: 'apprunner.yaml'
    });
  } catch (error) {
    console.error('Error reading environment from apprunner.yaml:', error);
    
    // Fallback to process.env if apprunner.yaml is not available
    return Response.json({ 
      environment: process.env.ENVIRONMENT || 'dev',
      source: 'process.env (fallback)'
    });
  }
}