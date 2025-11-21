import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: 'us-east-1' });

const corsConfiguration = {
  CORSRules: [
    {
      AllowedHeaders: ['*'],
      AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
      AllowedOrigins: ['http://localhost:3000', 'https://*.amazonaws.com'],
      ExposeHeaders: ['ETag'],
      MaxAgeSeconds: 3000
    }
  ]
};

async function configureCORS() {
  try {
    await s3Client.send(new PutBucketCorsCommand({
      Bucket: 'netsync-practicetools-bucket',
      CORSConfiguration: corsConfiguration
    }));
    console.log('✓ S3 CORS configured successfully');
  } catch (error) {
    console.error('✗ Failed to configure CORS:', error);
  }
}

configureCORS();
