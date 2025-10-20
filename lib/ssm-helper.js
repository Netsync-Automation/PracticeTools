import { getSecureParameter } from './ssm-config.js';

export async function getSSMParameter(paramName) {
  const env = process.env.ENVIRONMENT || 'dev';
  const ssmPrefix = env === 'prod' ? '/PracticeTools' : `/PracticeTools/${env}`;
  return await getSecureParameter(`${ssmPrefix}/${paramName}`);
}