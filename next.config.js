/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@aws-sdk/client-dynamodb', '@aws-sdk/credential-providers']
  },
  env: {
    ENVIRONMENT: process.env.ENVIRONMENT || 'dev',
    AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION || 'us-east-1'
  }
}

module.exports = nextConfig