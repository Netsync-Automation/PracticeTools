console.log('Environment Variables:');
console.log('ENVIRONMENT:', process.env.ENVIRONMENT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('All env vars starting with ENV:', Object.keys(process.env).filter(key => key.includes('ENV')).map(key => `${key}=${process.env[key]}`));